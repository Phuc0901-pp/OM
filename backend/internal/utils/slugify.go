package utils

import (
	"strings"

	"github.com/gosimple/slug"
)

// SlugifyName converts a Vietnamese string with accents into a clean URL-safe slug
// e.g. "Dự án điện mặt trời ABC" -> "du-an-dien-mat-troi-abc"
func SlugifyName(name string) string {
	// Fallback to "unknown" if empty
	if strings.TrimSpace(name) == "" {
		return "unknown"
	}
	
	// Use gosimple/slug which handles Vietnamese nicely via unidecode
	return slug.Make(name)
}

// BuildMinioPrefix constructs the standardized MinIO folder prefix based on context.
func BuildMinioPrefix(ctx interface{}) string {
	// We use interface{} to avoid circular imports if domain imports utils.
	// But it's safer to just take raw strings here to be purely decoupled.
	return ""
}
