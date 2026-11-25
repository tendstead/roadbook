package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

func queueAttachmentDeletion(ctx context.Context, tx pgx.Tx, entryID string) error {
	_, e := tx.Exec(ctx, "INSERT INTO pending_file_deletions SELECT id FROM attachments WHERE entry_id=$1 ON CONFLICT DO NOTHING", entryID)
	return e
}
func (s *Store) PendingFileDeletions(ctx context.Context) ([]string, error) {
	rows, e := s.Pool.Query(ctx, "SELECT id::text FROM pending_file_deletions ORDER BY id LIMIT 100")
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if e = rows.Scan(&id); e != nil {
			return nil, e
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
func (s *Store) FinishFileDeletion(ctx context.Context, id string) error {
	_, e := s.Pool.Exec(ctx, "DELETE FROM pending_file_deletions WHERE id=$1", id)
	return e
}
