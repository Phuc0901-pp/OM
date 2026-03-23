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
