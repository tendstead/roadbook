package attachments

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"image"
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"
	"github.com/tendstead/roadbook/internal/domain"
	_ "golang.org/x/image/webp"
)

const MaxBytes = 20 << 20

func Save(dir string, raw []byte) (domain.Attachment, error) {
	a := domain.Attachment{}
	if len(raw) == 0 || len(raw) > MaxBytes {
		return a, errors.New("image must be at most 20 MiB")
	}
	config, format, e := image.DecodeConfig(bytes.NewReader(raw))
	if e != nil || (format != "jpeg" && format != "png" && format != "webp") {
		return a, errors.New("upload a valid JPEG, PNG or WebP image")
	}
	if config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > 40000000 {
		return a, errors.New("image exceeds 40 megapixels")
	}
	im, e := imaging.Decode(bytes.NewReader(raw), imaging.AutoOrientation(true))
	if e != nil {
		return a, errors.New("image cannot be decoded")
	}
	hash := sha256.Sum256(raw)
	a = domain.Attachment{ID: domain.NewID(), MediaType: "image/" + format, Bytes: int64(len(raw)), Hash: hex.EncodeToString(hash[:])}
	if e = os.MkdirAll(dir, 0750); e != nil {
		return a, e
	}
	original := filepath.Join(dir, a.ID+".original")
	if e = os.WriteFile(original, raw, 0640); e != nil {
		return a, e
	}
	preview := imaging.Fit(im, 512, 512, imaging.Lanczos)
	file, e := os.OpenFile(filepath.Join(dir, a.ID+".thumb.jpg"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0640)
	if e == nil {
		e = jpeg.Encode(file, preview, &jpeg.Options{Quality: 80})
		closeErr := file.Close()
		a.HasThumbnail = e == nil && closeErr == nil
	}
	// A missing preview must never trigger an automatic original download.
	return a, nil
}
func Remove(dir, id string) error {
	if !domain.ValidID(id) {
		return errors.New("invalid file identifier")
	}
	for _, suffix := range []string{".original", ".thumb.jpg"} {
		if e := os.Remove(filepath.Join(dir, id+suffix)); e != nil && !os.IsNotExist(e) {
			return e
		}
	}
	return nil
}
