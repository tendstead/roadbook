package domain

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"strconv"
	"strings"
	"time"
)

type ImportSpec struct {
	CSV          string         `json:"csv"`
	Delimiter    string         `json:"delimiter"`
	Decimal      string         `json:"decimal"`
	DateFormat   string         `json:"date_format"`
	Kind         string         `json:"kind"`
	VehicleID    string         `json:"vehicle_id"`
	PayerID      string         `json:"payer_id"`
	DistanceUnit string         `json:"distance_unit"`
	FuelUnit     string         `json:"fuel_unit"`
	StartRow     int            `json:"start_row"`
	EndRow       int            `json:"end_row"`
	Columns      map[string]int `json:"columns"`
	TankOverride string         `json:"tank_override,omitempty"`
}
type ImportRow struct {
	SourceRow     int               `json:"source_row"`
	Entry         Record            `json:"entry"`
	Schedule      *Schedule         `json:"schedule,omitempty"`
	Warnings      []string          `json:"warnings"`
	Errors        []string          `json:"errors"`
	FieldErrors   map[string]string `json:"field_errors,omitempty"`
	UnknownFields []string          `json:"unknown_fields,omitempty"`
}

func (s ImportSpec) Fingerprint() string {
	raw, _ := json.Marshal(s)
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:])
}
func ImportNumber(text, decimal string, factor *big.Rat, money bool) (*int64, error) {
	s := strings.TrimSpace(text)
	if s == "" || s == "-" || s == "—" {
		return nil, nil
	}
	for _, symbol := range []string{"€", "$", "£", "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "\u00a0", "\u202f", " "} {
		s = strings.ReplaceAll(s, symbol, "")
	}
	if decimal == "," {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	} else {
		s = strings.ReplaceAll(s, ",", "")
	}
	// Avoid exponent/fraction notation and accidental coercion of arbitrary text.
	if len(s) > 40 {
		return nil, errors.New("number too long")
	}
	parts := strings.Split(s, ".")
	if len(parts) > 2 {
		return nil, errors.New("invalid decimal")
	}
	for i, c := range s {
		if c >= '0' && c <= '9' || c == '.' || c == '-' && i == 0 {
			continue
		}
		return nil, errors.New("invalid number")
	}
	if money && len(parts) == 2 && len(parts[1]) > 2 {
		return nil, errors.New("money has more than two decimal places")
	}
	value, ok := new(big.Rat).SetString(s)
	if !ok {
		return nil, errors.New("invalid number")
	}
	value.Mul(value, factor)
	rounded := new(big.Int).Quo(value.Num(), value.Denom())
	remainder := new(big.Int).Rem(value.Num(), value.Denom())
	remainder.Abs(remainder)
	remainder.Mul(remainder, big.NewInt(2))
	if remainder.Cmp(value.Denom()) >= 0 {
		if value.Sign() < 0 {
			rounded.Sub(rounded, big.NewInt(1))
		} else {
			rounded.Add(rounded, big.NewInt(1))
		}
	}
	if !rounded.IsInt64() {
		return nil, errors.New("number too large")
	}
	n := rounded.Int64()
	return &n, nil
}
func importDate(s, format string) (string, error) {
	layout := map[string]string{"DD.MM.YYYY": "02.01.2006", "DD/MM/YYYY": "02/01/2006", "YYYY.MM.DD": "2006.01.02", "YYYY-MM-DD": "2006-01-02", "MM/DD/YYYY": "01/02/2006"}[format]
	if layout == "" {
		return "", errors.New("unsupported date format")
	}
	d, e := time.Parse(layout, strings.TrimSpace(s))
	if e != nil {
		return "", errors.New("invalid date")
	}
	value := d.Format("2006-01-02")
	if !ValidDate(value) {
		return "", errors.New("year outside 1900–2100")
	}
	return value, nil
}
func PreviewImport(spec ImportSpec) ([]ImportRow, error) {
	if spec.TankOverride != "" && spec.TankOverride != "full" && spec.TankOverride != "partial" && spec.TankOverride != "unknown" {
		return nil, errors.New("choose full, partial or unknown tank status")
	}
	if len(spec.CSV) > 1500000 {
		return nil, errors.New("CSV exceeds 1.5 MB; split into smaller imports")
	}
	delimiter := []rune(spec.Delimiter)
	if len(delimiter) != 1 || (spec.Delimiter != "," && spec.Delimiter != ";" && spec.Delimiter != "\t") {
		return nil, errors.New("choose comma, semicolon or tab delimiter")
	}
	if spec.Kind != "fuel" && spec.Kind != "expense" && spec.Kind != "schedule" {
		return nil, errors.New("choose fuel, expense or schedule")
	}
	if spec.StartRow < 2 {
		return nil, errors.New("first data row must be at least 2; row 1 is the header")
	}
	if !ValidID(spec.VehicleID) || !ValidID(spec.PayerID) {
		return nil, errors.New("select a vehicle and payer")
	}
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(spec.CSV, "\ufeff")))
	reader.Comma = delimiter[0]
	reader.FieldsPerRecord = -1
	cells := [][]string{}
	for {
		row, e := reader.Read()
		if e == io.EOF {
			break
		}
		if e != nil {
			return nil, e
		}
		if len(row) > 100 {
			return nil, errors.New("maximum 100 columns")
		}
		cells = append(cells, row)
		if len(cells) > 10001 {
			return nil, errors.New("maximum 10000 rows")
		}
	}
	if len(cells) == 0 {
		return nil, errors.New("CSV is empty")
	}
	scale := big.NewRat(1000, 1)
	if spec.DistanceUnit == "mi" {
		scale = big.NewRat(1609344, 1000)
	} else if spec.DistanceUnit != "km" {
		return nil, errors.New("choose source distance unit")
	}
	volume := big.NewRat(1000, 1)
	switch spec.FuelUnit {
	case "L":
	case "US gal":
		volume = big.NewRat(3785411784, 1000000)
	case "Imp gal":
		volume = big.NewRat(454609, 100)
	default:
		return nil, errors.New("choose source fuel unit")
	}
	out := []ImportRow{}
	for index, row := range cells {
		number := index + 1
		if number < spec.StartRow || spec.EndRow > 0 && number > spec.EndRow {
			continue
		}
		result := ImportRow{SourceRow: number, Warnings: []string{}, Errors: []string{}}
		get := func(field string) string {
			col, ok := spec.Columns[field]
			if !ok || col < 0 || col >= len(row) {
				return ""
			}
			return row[col]
		}
		r := Record{FuelEntry: FuelEntry{Tank: "unknown"}, VehicleID: spec.VehicleID, PayerID: spec.PayerID, Kind: spec.Kind, Category: strings.TrimSpace(get("category")), Description: get("description"), Station: get("station"), FuelType: get("fuel_type"), Notes: get("notes"), Extra: map[string]string{}}
		if spec.Kind == "schedule" {
			r.Kind = "expense"
		}
		for col, value := range row {
			header := ""
			if col < len(cells[0]) {
				header = cells[0][col]
			}
			r.Extra[strconv.Itoa(col+1)+":"+header] = value
		}
		day, e := importDate(get("date"), spec.DateFormat)
		if e != nil {
			result.Errors = append(result.Errors, "Date: "+e.Error())
		}
		r.Date = day
		for _, field := range []struct {
			name   string
			dest   **int64
			factor *big.Rat
		}{{"amount_minor", &r.AmountMinor, big.NewRat(100, 1)}, {"volume_ml", &r.VolumeML, volume}, {"distance_m", &r.DistanceM, scale}, {"odometer_m", &r.OdometerM, scale}} {
			n, e := ImportNumber(get(field.name), spec.Decimal, field.factor, field.name == "amount_minor")
			if e != nil {
				result.Errors = append(result.Errors, field.name+": "+e.Error())
				if result.FieldErrors == nil {
					result.FieldErrors = map[string]string{}
				}
				result.FieldErrors[field.name] = e.Error()
			}
			*field.dest = n
		}
		if spec.Kind == "fuel" {
			switch strings.ToLower(strings.TrimSpace(get("tank"))) {
			case "full", "voll":
				r.Tank = "full"
			case "partial", "teil":
				r.Tank = "partial"
			case "", "unknown":
			default:
				result.Warnings = append(result.Warnings, "Unrecognized tank status retained in source cells; marked unknown")
			}
			r.Gap = strings.EqualFold(get("gap"), "true") || get("gap") == "1"
			if spec.TankOverride != "" {
				r.Tank = spec.TankOverride
				r.Extra["import:tank_override"] = spec.TankOverride
			}
			if r.VolumeML == nil || r.DistanceM == nil && r.OdometerM == nil || r.Tank == "unknown" {
				result.Warnings = append(result.Warnings, "Incomplete fuel measurements or unknown tank status; consumption may be unavailable")
			}
		} else if r.Category == "" {
			r.Category = "other"
			result.Warnings = append(result.Warnings, "No category supplied; review Other category")
		}
		if e = r.Validate(); e != nil {
			result.Errors = append(result.Errors, e.Error())
		}
		result.Entry = r
		if spec.Kind == "schedule" {
			frequency := strings.ToLower(strings.TrimSpace(get("frequency")))
			months := map[string]int{"monthly": 1, "quarterly": 3, "annually": 12, "annual": 12, "yearly": 12, "1": 1, "3": 3, "12": 12}[frequency]
			sch := Schedule{Template: r, First: r.Date, Months: months, Active: true}
			if get("end_date") != "" {
				sch.End, e = importDate(get("end_date"), spec.DateFormat)
				if e != nil {
					result.Errors = append(result.Errors, "Invalid schedule end date")
					if result.FieldErrors == nil {
						result.FieldErrors = map[string]string{}
					}
					result.FieldErrors["end_date"] = e.Error()
				}
			}
			if e = sch.Validate(); e != nil {
				result.Errors = append(result.Errors, e.Error())
			}
			result.Schedule = &sch
		}
		out = append(out, result)
	}
	if len(out) == 0 {
		return nil, errors.New("selected range contains no records")
	}
	return out, nil
}
func RecordKey(r Record) string {
	return fmt.Sprintf("%s|%s|%s|%v|%v|%v|%v|%s", r.VehicleID, r.Kind, r.Date, optional(r.AmountMinor), optional(r.VolumeML), optional(r.DistanceM), optional(r.OdometerM), r.Category)
}
func optional(n *int64) string {
	if n == nil {
		return "?"
	}
	return strconv.FormatInt(*n, 10)
}
