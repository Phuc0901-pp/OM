package messaging

import (
	"strings"
	"testing"
)

func TestMinioWorker_ProcessUpload_PoisonMessage(t *testing.T) {
	// 1. Initialise a dummy worker (no connection needed for this focused test)
	w := &MinioWorker{}

	// 2. Create an event targeting a file that definitely does not exist
	event := UploadRequestEvent{
		DetailAssignID: "12345-abc",
		TempPath:       "/tmp/non_existent_file_poison_test.jpg",
		Filename:       "test.jpg",
	}

	// 3. Execute
	err := w.processUpload(event)

	// 4. Assert that it properly identifies this as a "Poison" message
	// Expected behaviour: When file is unrecoverably deleted (e.g. after container restart), 
	// it must throw a POISON_FILE_MISSING error so the caller can NACK without requeue.
	if err == nil {
		t.Fatal("Expected an error for missing file, got nil")
	}

	if !strings.HasPrefix(err.Error(), "POISON_FILE_MISSING:") {
		t.Errorf("Expected error to start with POISON_FILE_MISSING:, got %v", err)
	}
}
