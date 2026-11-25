package main

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/tendstead/roadbook/internal/httpapi"
	"github.com/tendstead/roadbook/internal/store"
)

//go:embed static/*
var content embed.FS

func main() {
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		client := http.Client{Timeout: 3 * time.Second}
		res, err := client.Get("http://127.0.0.1:" + env("PORT", "8080") + "/api/ready")
		if err != nil {
			os.Exit(1)
		}
		_ = res.Body.Close()
		if res.StatusCode != 200 {
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		slog.Error("Roadbook stopped", "error", err)
		os.Exit(1)
	}
}
func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	startup, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	s, err := store.Open(startup, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer s.Close()
	assets, err := fs.Sub(content, "static")
	if err != nil {
		return err
	}
	server := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: httpapi.Application(s, assets, env("DATA_DIR", "/data")), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	result := make(chan error, 1)
	go func() { slog.Info("Roadbook listening", "address", server.Addr); result <- server.ListenAndServe() }()
	select {
	case err = <-result:
		if err != http.ErrServerClosed {
			return err
		}
	case <-ctx.Done():
	}
	shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
	defer done()
	return server.Shutdown(shutdown)
}
func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
