package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"slices"

	"github.com/tendstead/roadbook/internal/attachments"
	"github.com/tendstead/roadbook/internal/domain"
)

func (a *application) cleanupFiles(ctx context.Context) {
	ids, e := a.store.PendingFileDeletions(ctx)
	if e != nil {
		return
	}
	for _, id := range ids {
		if attachments.Remove(a.dataDir, id) == nil {
			_ = a.store.FinishFileDeletion(ctx, id)
		}
	}
}

func (a *application) upload(w http.ResponseWriter, r *http.Request) {
	select {
	case a.imageSlots <- struct{}{}:
		defer func() { <-a.imageSlots }()
	case <-r.Context().Done():
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, attachments.MaxBytes+(1<<20))
	if e := r.ParseMultipartForm(1 << 20); e != nil {
		JSON(w, 400, map[string]string{"error": "Invalid upload or image larger than 20 MiB"})
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	entryID := r.FormValue("entry_id")
	index := slices.IndexFunc(state.Records, func(e domain.Record) bool { return e.ID == entryID })
	if index < 0 {
		JSON(w, 404, map[string]string{"error": "Save an entry before attaching images"})
		return
	}
	if !allowed(w, state, p, state.Records[index].VehicleID) {
		return
	}
	purpose := r.FormValue("purpose")
	if !slices.Contains([]string{"dashboard", "receipt", "bill"}, purpose) {
		JSON(w, 400, map[string]string{"error": "Invalid attachment purpose"})
		return
	}
	file, header, e := r.FormFile("file")
	if e != nil {
		JSON(w, 400, map[string]string{"error": "Image file required"})
		return
	}
	defer func() { _ = file.Close() }()
	raw, e := io.ReadAll(io.LimitReader(file, attachments.MaxBytes+1))
	if e != nil {
		JSON(w, 400, map[string]string{"error": "Could not read image"})
		return
	}
	hash := sha256.Sum256(raw)
	digest := hex.EncodeToString(hash[:])
	for _, existing := range state.Attachments {
		if existing.EntryID == entryID && existing.Purpose == purpose && existing.Hash == digest {
			JSON(w, 200, existing)
			return
		}
	}
	at, e := attachments.Save(a.dataDir, raw)
	if e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	at.EntryID = entryID
	at.Purpose = purpose
	at.Filename = filepath.Base(header.Filename)
	if e = a.store.SaveAttachment(r.Context(), at); e != nil {
		_ = attachments.Remove(a.dataDir, at.ID)
		JSON(w, 503, map[string]string{"error": "Unable to save attachment metadata"})
		return
	}
	JSON(w, 201, at)
}
func (a *application) image(w http.ResponseWriter, r *http.Request) {
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	index := slices.IndexFunc(state.Attachments, func(at domain.Attachment) bool { return at.ID == r.PathValue("id") })
	if index < 0 {
		http.NotFound(w, r)
		return
	}
	at := state.Attachments[index]
	entry := slices.IndexFunc(state.Records, func(e domain.Record) bool { return e.ID == at.EntryID })
	if entry < 0 || !allowed(w, state, p, state.Records[entry].VehicleID) {
		return
	}
	variant := r.PathValue("variant")
	suffix := ".original"
	media := at.MediaType
	if variant == "thumb" {
		if !at.HasThumbnail {
			http.NotFound(w, r)
			return
		}
		suffix = ".thumb.jpg"
		media = "image/jpeg"
	} else if variant != "original" {
		http.NotFound(w, r)
		return
	}
	file, e := os.Open(filepath.Join(a.dataDir, at.ID+suffix))
	if e != nil {
		http.NotFound(w, r)
		return
	}
	defer func() { _ = file.Close() }()
	info, e := file.Stat()
	if e != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", media)
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("ETag", `"`+at.Hash+suffix+`"`)
	disposition := "inline"
	if r.URL.Query().Get("download") == "1" {
		disposition = "attachment"
	}
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": at.Filename}))
	http.ServeContent(w, r, at.Filename, info.ModTime(), file)
}
func (a *application) deleteAttachment(w http.ResponseWriter, r *http.Request) {
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	index := slices.IndexFunc(state.Attachments, func(at domain.Attachment) bool { return at.ID == id })
	if index < 0 {
		http.NotFound(w, r)
		return
	}
	at := state.Attachments[index]
	entry := slices.IndexFunc(state.Records, func(e domain.Record) bool { return e.ID == at.EntryID })
	if entry < 0 || !allowed(w, state, p, state.Records[entry].VehicleID) {
		return
	}
	if failure(w, a.store.DeleteAttachment(r.Context(), id)) {
		return
	}
	a.cleanupFiles(r.Context())
	JSON(w, 200, map[string]bool{"deleted": true})
}
