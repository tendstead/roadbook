package domain

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"regexp"
	"slices"
	"strings"
	"time"
)

func NewID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	s := hex.EncodeToString(b[:])
	return s[:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:]
}

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func ValidID(s string) bool { return uuidPattern.MatchString(s) }

type Profile struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type Settings struct {
	DistanceUnit string `json:"distance_unit"`
	FuelUnit     string `json:"fuel_unit"`
	Currency     string `json:"currency"`
	Timezone     string `json:"timezone"`
}
type Vehicle struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Kind             string   `json:"kind"`
	FuelType         string   `json:"fuel_type"`
	OwnerID          string   `json:"owner_id"`
	Members          []string `json:"members"`
	OwnershipStart   string   `json:"ownership_start"`
	OwnershipEnd     string   `json:"ownership_end"`
	InitialOdometerM *int64   `json:"initial_odometer_m"`
}
type Record struct {
	FuelEntry
	Currency    string            `json:"currency,omitempty"`
	VehicleID   string            `json:"vehicle_id"`
	PayerID     string            `json:"payer_id"`
	Kind        string            `json:"kind"`
	Category    string            `json:"category"`
	Description string            `json:"description"`
	Station     string            `json:"station"`
	FuelType    string            `json:"fuel_type"`
	Notes       string            `json:"notes"`
	ScheduleID  string            `json:"schedule_id,omitempty"`
	Extra       map[string]string `json:"extra,omitempty"`
}
type Schedule struct {
	ID       string `json:"id"`
	Template Record `json:"template"`
	First    string `json:"first"`
	End      string `json:"end"`
	Months   int    `json:"months"`
	Active   bool   `json:"active"`
}
type Attachment struct {
	ID           string `json:"id"`
	EntryID      string `json:"entry_id"`
	Purpose      string `json:"purpose"`
	Filename     string `json:"filename"`
	MediaType    string `json:"media_type"`
	Bytes        int64  `json:"bytes"`
	Hash         string `json:"hash"`
	HasThumbnail bool   `json:"has_thumbnail"`
}
type State struct {
	Settings    Settings     `json:"settings"`
	Profiles    []Profile    `json:"profiles"`
	Vehicles    []Vehicle    `json:"vehicles"`
	Records     []Record     `json:"records"`
	Schedules   []Schedule   `json:"schedules"`
	Attachments []Attachment `json:"attachments"`
}

var Categories = []string{"repair", "service", "tyres", "inspection", "parts", "purchase", "insurance", "tax", "lease", "parking", "toll", "other"}

func IsUpkeep(category string) bool { return slices.Contains(Categories[:5], category) }
func ValidDate(s string) bool {
	d, e := time.Parse("2006-01-02", s)
	return e == nil && d.Year() >= 1900 && d.Year() <= 2100
}
func (v Vehicle) Validate() error {
	if strings.TrimSpace(v.Name) == "" || len(v.Name) > 120 || !ValidID(v.OwnerID) || !slices.Contains([]string{"car", "motorbike", "other"}, v.Kind) {
		return errors.New("vehicle requires a name, valid owner and kind")
	}
	if v.OwnershipStart != "" && !ValidDate(v.OwnershipStart) || v.OwnershipEnd != "" && !ValidDate(v.OwnershipEnd) || v.OwnershipEnd != "" && v.OwnershipStart != "" && v.OwnershipEnd < v.OwnershipStart {
		return errors.New("invalid ownership dates")
	}
	if v.InitialOdometerM != nil && (*v.InitialOdometerM < 0 || *v.InitialOdometerM > 1e12) {
		return errors.New("invalid odometer")
	}
	return nil
}
func (r Record) Validate() error {
	if !ValidID(r.VehicleID) || !ValidID(r.PayerID) || !ValidDate(r.Date) {
		return errors.New("vehicle, payer and valid date required")
	}
	// Up to 100 original CSV cells plus bounded import provenance/corrections.
	if len(r.Notes) > 20000 || len(r.Description) > 1000 || len(r.Station) > 200 || len(r.Extra) > 128 {
		return errors.New("text too long")
	}
	if r.AmountMinor != nil && (*r.AmountMinor < -1e12 || *r.AmountMinor > 1e12) {
		return errors.New("amount outside supported range")
	}
	for _, n := range []*int64{r.OdometerM, r.DistanceM, r.VolumeML} {
		if n != nil && (*n < 0 || *n > 1e12) {
			return errors.New("measurement outside supported range")
		}
	}
	switch r.Kind {
	case "fuel":
		if !slices.Contains([]string{"full", "partial", "unknown"}, r.Tank) {
			return errors.New("choose full, partial or unknown tank status")
		}
		if r.AmountMinor != nil && *r.AmountMinor < 0 {
			return errors.New("use an expense refund for negative costs")
		}
	case "expense":
		if r.AmountMinor == nil || !slices.Contains(Categories, r.Category) {
			return errors.New("expense requires an amount and category")
		}
	default:
		return errors.New("invalid entry type")
	}
	return nil
}
func (s Schedule) Validate() error {
	if s.Template.Kind != "expense" || !ValidDate(s.First) || s.End != "" && (!ValidDate(s.End) || s.End < s.First) || (s.Months != 1 && s.Months != 3 && s.Months != 12) {
		return errors.New("invalid recurring expense dates or frequency")
	}
	r := s.Template
	r.Date = s.First
	return r.Validate()
}
