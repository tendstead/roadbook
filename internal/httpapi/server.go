package httpapi

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"
)

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func New(ready func(context.Context) error, assets fs.FS) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { JSON(w, 200, map[string]string{"status": "ok"}) })
	mux.HandleFunc("GET /api/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if ready(ctx) != nil {
			JSON(w, 503, map[string]string{"error": "Database unavailable"})
			return
		}
		JSON(w, 200, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { JSON(w, 404, map[string]string{"error": "Not found"}) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if _, err := fs.Stat(assets, name); err != nil {
			if strings.Contains(path.Base(name), ".") {
				http.NotFound(w, r)
				return
			}
			content, err := fs.ReadFile(assets, "index.html")
			if err != nil {
				http.Error(w, "Frontend not built", http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write(content)
			return
		}
		http.FileServer(http.FS(assets)).ServeHTTP(w, r)
	})
	return mux
}
