package httpapi

import (
	"context"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

// These tests catch accidental DB-coupled liveness and broken SPA deep links.
func TestHealthAndReadiness(t *testing.T) {
	for _, tc := range []struct {
		path  string
		ready bool
		want  int
	}{
		{"/api/health", false, 200}, {"/api/ready", false, 503}, {"/api/ready", true, 200},
	} {
		check := func(context.Context) error {
			if !tc.ready {
				return errors.New("offline")
			}
			return nil
		}
		h := New(check, fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("Roadbook shell")}})
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", tc.path, nil))
		if w.Code != tc.want {
			t.Errorf("%s got %d want %d", tc.path, w.Code, tc.want)
		}
	}
}
func TestSPADeepLinksAndAPINotFound(t *testing.T) {
	var assets fs.FS = fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("Roadbook shell")}}
	h := New(func(context.Context) error { return nil }, assets)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/fuel", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "Roadbook shell") {
		t.Fatal(w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/api/missing", nil))
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
}
