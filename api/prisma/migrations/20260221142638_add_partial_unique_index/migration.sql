CREATE UNIQUE INDEX one_active_batch_per_patient
ON "AlignerBatch" ("patientId")
WHERE status NOT IN ('DELIVERED_TO_CLINIC', 'HANDED_TO_PATIENT', 'CANCELLED');