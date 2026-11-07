package store

import (
	"context"
	"os"
	"testing"
)

// Run explicitly under service-test; normal unit runs do not need PostgreSQL.
func TestMigrationsAreRepeatable(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("SERVICE_TEST") == "1" {
			t.Fatal("TEST_DATABASE_URL required")
		}
		t.Skip("isolated service database required")
	}
	ctx := context.Background()
	s, err := Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err = s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	var n int
	if err = s.Pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations").Scan(&n); err != nil || n < 1 {
		t.Fatal(n, err)
	}
}
