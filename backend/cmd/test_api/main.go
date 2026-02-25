package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
)

func main() {
	baseURL := "http://localhost:4000/api/attendance/lookup"
	params := url.Values{}
	params.Add("user_id", "fd0c853c-9939-486d-9195-334ff51e3c38")
	params.Add("date", "2026-02-10T16:10:47.48186+07:00")

	fullURL := baseURL + "?" + params.Encode()
	fmt.Println("Testing URL:", fullURL)

	resp, err := http.Get(fullURL)
	if err != nil {
		fmt.Printf("HTTP Request Error: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("HTTP Status: %d\n", resp.StatusCode)
	fmt.Printf("Response Body: %s\n", string(body))
}
