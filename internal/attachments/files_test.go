package attachments

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestOriginalPreservedAndPreviewPersisted(t *testing.T) {
	im := image.NewRGBA(image.Rect(0, 0, 1200, 800))
	im.Set(0, 0, color.White)
	var raw bytes.Buffer
	if e := jpeg.Encode(&raw, im, nil); e != nil {
		t.Fatal(e)
	}
	dir := t.TempDir()
	a, e := Save(dir, raw.Bytes())
	if e != nil {
		t.Fatal(e)
	}
	got, e := os.ReadFile(filepath.Join(dir, a.ID+".original"))
	if e != nil || !bytes.Equal(got, raw.Bytes()) {
		t.Fatal("original was altered", e)
	}
	thumb, e := os.Open(filepath.Join(dir, a.ID+".thumb.jpg"))
	if e != nil {
		t.Fatal(e)
	}
	defer func() { _ = thumb.Close() }()
	config, e := jpeg.DecodeConfig(thumb)
	if e != nil || config.Width != 512 || config.Height > 512 {
		t.Fatal(config, e)
	}
	if !a.HasThumbnail || a.Hash == "" {
		t.Fatal(a)
	}
}
func TestInvalidImageRejectedWithoutFiles(t *testing.T) {
	dir := t.TempDir()
	if _, e := Save(dir, []byte("not an image")); e == nil {
		t.Fatal("accepted invalid image")
	}
	files, e := os.ReadDir(dir)
	if e != nil || len(files) != 0 {
		t.Fatal(files, e)
	}
}
