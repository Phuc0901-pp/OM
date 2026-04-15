package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

func main() {
	url := "http://localhost:4001/api/assigns?user_id=a39aaf75-5a65-4545-9beb-d42a7cdb2f0c"
	req, _ := http.NewRequest("GET", url, nil)
	
	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzYxMzg2NzQsInJvbGUiOiJlbmdpbmVlciIsInVzZXJfaWQiOiJhMzlhYWY3NS01YTY1LTQ1NDUtOWJlYi1kNDJhN2NkYjJmMGMifQ.jX1PJcYaUdYbz82c6GVB-Id3FjqOqUK84cR1n7-OLOs"
	req.Header.Add("Authorization", "Bearer "+token)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer res.Body.Close()

	body, _ := ioutil.ReadAll(res.Body)
	
	var data []map[string]interface{}
	json.Unmarshal(body, &data)

	found := false
	for _, assign := range data {
		if details, ok := assign["details"].([]interface{}); ok {
			for _, d := range details {
				detail := d.(map[string]interface{})
				if detail["id"] == "d447e3ac-3b90-4dce-8cb3-bf34d85e81fd" {
					fmt.Printf("Task Found!\n")
					taskData := detail["data"]
					
					fmt.Printf("Raw Data Type: %T\n", taskData)
					if strData, isStr := taskData.(string); isStr {
						fmt.Printf("Raw String Data: %s\n", strData)
						var arr []string
						json.Unmarshal([]byte(strData), &arr)
						fmt.Printf("Parsed Array Length: %d\n", len(arr))
						for i, item := range arr {
							fmt.Printf(" - %d: %s\n", i, item)
						}
					} else if arr, isArr := taskData.([]interface{}); isArr {
						fmt.Printf("Array Data Length: %d\n", len(arr))
						for i, item := range arr {
							fmt.Printf(" - %d: %s\n", i, item)
						}
					} else {
						fmt.Printf("Unknown data format: %v\n", taskData)
					}
					
					fetched := detail["status_submit"]
					fmt.Printf("status_submit: %v\n", fetched)
					found = true
				}
			}
		}
	}
	if !found {
		fmt.Println("Task not found in API response")
	}
}
