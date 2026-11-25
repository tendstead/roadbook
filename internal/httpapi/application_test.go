package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestBrowserWriteProtection(t *testing.T) {
	h := Application(nil, fstest.MapFS{}, t.TempDir())
	for _, tc := range []struct {
		origin, header string
		want           int
	}{{"https://evil.test", "1", 403}, {"", "", 403}} {
		r := httptest.NewRequest("POST", "http://roadbook.test/api/profiles", strings.NewReader(`{"name":"Other"}`))
		r.Header.Set("Origin", tc.origin)
		r.Header.Set("X-Roadbook-Request", tc.header)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("got %d want %d", w.Code, tc.want)
		}
	}
}
