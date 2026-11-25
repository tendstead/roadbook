package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/tendstead/roadbook/internal/domain"
	"github.com/tendstead/roadbook/internal/store"
)

type application struct {
	store      *store.Store
	dataDir    string
	imageSlots chan struct{}
}

func Application(s *store.Store, assets fs.FS, dataDir string) http.Handler {
	a := &application{store: s, dataDir: dataDir, imageSlots: make(chan struct{}, 1)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/state", a.state)
	mux.HandleFunc("POST /api/profiles", a.profile)
	mux.HandleFunc("PUT /api/profiles/{id}", a.profile)
	mux.HandleFunc("POST /api/vehicles", a.vehicle)
	mux.HandleFunc("PUT /api/vehicles/{id}", a.vehicle)
	mux.HandleFunc("POST /api/entries", a.entry)
	mux.HandleFunc("PUT /api/entries/{id}", a.entry)
	mux.HandleFunc("DELETE /api/entries/{id}", a.deleteEntry)
	mux.HandleFunc("POST /api/schedules", a.schedule)
	mux.HandleFunc("PUT /api/schedules/{id}", a.schedule)
	mux.HandleFunc("PUT /api/settings", a.settings)
	mux.HandleFunc("GET /api/export", a.export)
	mux.HandleFunc("POST /api/import/preview", a.preview)
	mux.HandleFunc("POST /api/import/commit", a.commitImport)
	mux.HandleFunc("POST /api/attachments", a.upload)
	mux.HandleFunc("GET /api/attachments/{id}/{variant}", a.image)
	mux.HandleFunc("DELETE /api/attachments/{id}", a.deleteAttachment)
	mux.Handle("/", New(func(ctx context.Context) error {
		if s == nil {
			return errors.New("database unavailable")
		}
		return s.Pool.Ping(ctx)
	}, assets))
	return protect(mux)
}
func protect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		if r.Method != "GET" && r.Method != "HEAD" && r.Method != "OPTIONS" {
			origin := r.Header.Get("Origin")
			valid := true
			if origin != "" {
				u, e := url.Parse(origin)
				valid = e == nil && u.Host == r.Host && (u.Scheme == "http" || u.Scheme == "https")
			}
			if !valid || r.Header.Get("Sec-Fetch-Site") == "cross-site" || r.Header.Get("X-Roadbook-Request") != "1" {
				JSON(w, 403, map[string]string{"error": "Same-origin Roadbook request required"})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	media, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if media != "application/json" {
		JSON(w, 415, map[string]string{"error": "application/json required"})
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		JSON(w, 400, map[string]string{"error": "Invalid JSON or unsupported fields"})
		return false
	}
	if d.Decode(new(any)) != io.EOF {
		JSON(w, 400, map[string]string{"error": "Expected one JSON value"})
		return false
	}
	return true
}
func failure(w http.ResponseWriter, e error) bool {
	if e == nil {
		return false
	}
	JSON(w, 400, map[string]string{"error": "Unable to save: check values, references and immutable schedule fields"})
	return true
}
func (a *application) load(w http.ResponseWriter, r *http.Request) (domain.State, string, bool) {
	state, e := a.store.Snapshot(r.Context())
	if e != nil {
		JSON(w, 503, map[string]string{"error": "Database unavailable"})
		return state, "", false
	}
	profile := r.Header.Get("X-Roadbook-Profile")
	if profile == "" {
		profile = r.URL.Query().Get("profile")
	}
	if profile == "" && len(state.Profiles) > 0 {
		profile = state.Profiles[0].ID
	}
	if !slices.ContainsFunc(state.Profiles, func(p domain.Profile) bool { return p.ID == profile }) {
		JSON(w, 400, map[string]string{"error": "Select an existing profile"})
		return state, profile, false
	}
	return state, profile, true
}
func accessible(state domain.State, profile, vehicle string) bool {
	return slices.ContainsFunc(state.Vehicles, func(v domain.Vehicle) bool {
		return v.ID == vehicle && (v.OwnerID == profile || slices.Contains(v.Members, profile))
	})
}
func allowed(w http.ResponseWriter, state domain.State, profile, vehicle string) bool {
	if accessible(state, profile, vehicle) {
		return true
	}
	JSON(w, 403, map[string]string{"error": "Vehicle is not assigned to this profile"})
	return false
}
func today(settings domain.Settings) string {
	loc, e := time.LoadLocation(settings.Timezone)
	if e != nil {
		loc = time.UTC
	}
	return time.Now().In(loc).Format("2006-01-02")
}
func (a *application) state(w http.ResponseWriter, r *http.Request) {
	a.cleanupFiles(r.Context())
	state, profile, ok := a.load(w, r)
	if !ok {
		return
	}
	if e := a.store.Materialize(r.Context(), today(state.Settings)); e != nil {
		JSON(w, 503, map[string]string{"error": "Unable to generate due expenses"})
		return
	}
	state, _, ok = a.load(w, r)
	if !ok {
		return
	}
	all := state
	state.Vehicles = slices.DeleteFunc(slices.Clone(state.Vehicles), func(v domain.Vehicle) bool { return !accessible(all, profile, v.ID) })
	state.Records = slices.DeleteFunc(slices.Clone(state.Records), func(e domain.Record) bool { return !accessible(all, profile, e.VehicleID) })
	state.Schedules = slices.DeleteFunc(slices.Clone(state.Schedules), func(s domain.Schedule) bool { return !accessible(all, profile, s.Template.VehicleID) })
	state.Attachments = slices.DeleteFunc(slices.Clone(state.Attachments), func(at domain.Attachment) bool {
		return !slices.ContainsFunc(state.Records, func(e domain.Record) bool { return e.ID == at.EntryID })
	})
	JSON(w, 200, map[string]any{"state": state, "profile_id": profile, "stats": domain.Summarize(state, today(state.Settings))})
}
func (a *application) profile(w http.ResponseWriter, r *http.Request) {
	var p domain.Profile
	if !readJSON(w, r, &p) {
		return
	}
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" || len(p.Name) > 120 {
		JSON(w, 400, map[string]string{"error": "Profile name required (maximum 120 characters)"})
		return
	}
	p.ID = r.PathValue("id")
	if p.ID == "" {
		p.ID = domain.NewID()
	} else if !domain.ValidID(p.ID) {
		JSON(w, 400, map[string]string{"error": "Invalid profile"})
		return
	}
	if failure(w, a.store.SaveProfile(r.Context(), p)) {
		return
	}
	JSON(w, 200, p)
}
func (a *application) vehicle(w http.ResponseWriter, r *http.Request) {
	state, profile, ok := a.load(w, r)
	if !ok {
		return
	}
	var v domain.Vehicle
	if !readJSON(w, r, &v) {
		return
	}
	v.ID = r.PathValue("id")
	if v.ID == "" {
		v.ID = domain.NewID()
		v.OwnerID = profile
	} else {
		old := slices.IndexFunc(state.Vehicles, func(vv domain.Vehicle) bool { return vv.ID == v.ID && vv.OwnerID == profile })
		if old < 0 {
			JSON(w, 403, map[string]string{"error": "Only the owner can change this vehicle"})
			return
		}
		v.OwnerID = state.Vehicles[old].OwnerID
	}
	if !slices.Contains(v.Members, v.OwnerID) {
		v.Members = append(v.Members, v.OwnerID)
	}
	if e := v.Validate(); e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	if failure(w, a.store.SaveVehicle(r.Context(), v)) {
		return
	}
	JSON(w, 200, v)
}
func (a *application) entry(w http.ResponseWriter, r *http.Request) {
	state, profile, ok := a.load(w, r)
	if !ok {
		return
	}
	var entry domain.Record
	if !readJSON(w, r, &entry) {
		return
	}
	entry.ID = r.PathValue("id")
	if entry.ID == "" {
		entry.ID = domain.NewID()
	} else {
		i := slices.IndexFunc(state.Records, func(old domain.Record) bool {
			return old.ID == entry.ID && old.VehicleID == entry.VehicleID && old.Kind == entry.Kind
		})
		if i < 0 {
			JSON(w, 404, map[string]string{"error": "Entry not found"})
			return
		}
		entry.ScheduleID = state.Records[i].ScheduleID
	}
	if !allowed(w, state, profile, entry.VehicleID) {
		return
	}
	if entry.PayerID == "" {
		entry.PayerID = profile
	}
	if !slices.ContainsFunc(state.Profiles, func(p domain.Profile) bool { return p.ID == entry.PayerID }) {
		JSON(w, 400, map[string]string{"error": "Unknown payer"})
		return
	}
	if e := entry.Validate(); e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	if failure(w, a.store.SaveRecord(r.Context(), entry)) {
		return
	}
	JSON(w, 200, entry)
}
func (a *application) deleteEntry(w http.ResponseWriter, r *http.Request) {
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	i := slices.IndexFunc(state.Records, func(e domain.Record) bool { return e.ID == id })
	if i < 0 {
		JSON(w, 404, map[string]string{"error": "Entry not found"})
		return
	}
	entry := state.Records[i]
	if !allowed(w, state, p, entry.VehicleID) {
		return
	}
	if entry.ScheduleID != "" {
		JSON(w, 409, map[string]string{"error": "Edit the recurring charge to zero or record a refund; deleting would regenerate it"})
		return
	}
	if failure(w, a.store.DeleteRecord(r.Context(), id)) {
		return
	}
	a.cleanupFiles(r.Context())
	JSON(w, 200, map[string]bool{"deleted": true})
}
func (a *application) schedule(w http.ResponseWriter, r *http.Request) {
	state, p, ok := a.load(w, r)
	if !ok {
		return
	}
	var sch domain.Schedule
	if !readJSON(w, r, &sch) {
		return
	}
	if !allowed(w, state, p, sch.Template.VehicleID) {
		return
	}
	if sch.Template.PayerID == "" {
		sch.Template.PayerID = p
	}
	sch.Template.Kind = "expense"
	sch.Template.Date = sch.First
	sch.ID = r.PathValue("id")
	if sch.ID == "" {
		sch.ID = domain.NewID()
	} else {
		if !slices.ContainsFunc(state.Schedules, func(s domain.Schedule) bool { return s.ID == sch.ID && s.Template.VehicleID == sch.Template.VehicleID }) {
			JSON(w, 404, map[string]string{"error": "Schedule not found"})
			return
		}
	}
	if e := sch.Validate(); e != nil {
		JSON(w, 400, map[string]string{"error": e.Error()})
		return
	}
	if failure(w, a.store.Materialize(r.Context(), today(state.Settings))) {
		return
	}
	if failure(w, a.store.SaveSchedule(r.Context(), sch)) {
		return
	}
	JSON(w, 200, sch)
}
func (a *application) settings(w http.ResponseWriter, r *http.Request) {
	var c domain.Settings
	if !readJSON(w, r, &c) {
		return
	}
	_, e := time.LoadLocation(c.Timezone)
	if !slices.Contains([]string{"km", "mi"}, c.DistanceUnit) || !slices.Contains([]string{"L", "US gal", "Imp gal"}, c.FuelUnit) || !slices.Contains([]string{"EUR", "USD", "GBP", "CHF", "CAD", "AUD"}, c.Currency) || e != nil {
		JSON(w, 400, map[string]string{"error": "Choose valid units, supported currency and IANA timezone"})
		return
	}
	if failure(w, a.store.SaveSettings(r.Context(), c)) {
		return
	}
	JSON(w, 200, c)
}
func (a *application) export(w http.ResponseWriter, r *http.Request) {
	state, _, ok := a.load(w, r)
	if !ok {
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="roadbook-export.json"`)
	JSON(w, 200, map[string]any{"version": 1, "units": map[string]string{"distance": "metres", "volume": "millilitres", "money": "currency minor units"}, "state": state})
}
