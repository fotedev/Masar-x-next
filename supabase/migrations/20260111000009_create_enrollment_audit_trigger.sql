/*
  # Create PostgreSQL trigger for enrollment audit logging

  ## Overview
  Creates a trigger function and trigger that automatically logs all changes to the enrollments table.
  This ensures complete transparency for subscription approvals and rejections.

  ## Trigger Details

  ### Function: `audit_enrollment_changes()`
  - Triggered on UPDATE operations on enrollments table
  - Logs the operation type, user who performed it, and before/after data
  - Only logs when status changes (pending -> active/expired)

  ### Trigger: `trigger_audit_enrollment_changes`
  - Fires AFTER UPDATE on enrollments table
  - Calls the audit function for each changed row
*/

-- Create the audit trigger function
CREATE OR REPLACE FUNCTION audit_enrollment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  operation_type text;
  current_user_id uuid;
BEGIN
  -- Only log status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determine operation type
  CASE
    WHEN OLD.status = 'pending' AND NEW.status = 'active' THEN
      operation_type := 'enrollment_approved';
    WHEN OLD.status = 'pending' AND NEW.status = 'expired' THEN
      operation_type := 'enrollment_rejected';
    WHEN OLD.status = 'active' AND NEW.status = 'expired' THEN
      operation_type := 'enrollment_expired';
    ELSE
      operation_type := 'enrollment_status_changed';
  END CASE;

  -- Get current user (the one performing the operation)
  -- In Supabase, this should be available via auth.uid()
  current_user_id := auth.uid();

  -- If no authenticated user (shouldn't happen in normal operation), skip logging
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_logs (
    operation_name,
    user_id,
    changed_data
  ) VALUES (
    operation_type,
    current_user_id,
    jsonb_build_object(
      'enrollment_id', NEW.id,
      'student_id', NEW.student_id,
      'course_id', NEW.course_id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'payment_screenshot_url', NEW.payment_screenshot_url,
      'changed_at', NEW.updated_at
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE OR REPLACE TRIGGER trigger_audit_enrollment_changes
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION audit_enrollment_changes();

-- Grant necessary permissions
-- The function runs with SECURITY DEFINER, so it has access to insert into audit_logs