package store

import (
	"context"
	"encoding/json"
	"github.com/tendstead/roadbook/internal/domain"
)

func (s *Store) SaveAttachment(ctx context.Context, a domain.Attachment) error {
	raw, e := json.Marshal(a)
	if e != nil {
		return e
	}
	_, e = s.Pool.Exec(ctx, "INSERT INTO attachments(id,entry_id,body) VALUES($1,$2,$3)", a.ID, a.EntryID, raw)
	return e
}
func (s *Store) DeleteAttachment(ctx context.Context, id string) error {
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, e = tx.Exec(ctx, "INSERT INTO pending_file_deletions SELECT id FROM attachments WHERE id=$1 ON CONFLICT DO NOTHING", id); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, "DELETE FROM attachments WHERE id=$1", id); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
