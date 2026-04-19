-- Migration: Add can_leave_alone column to participants
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS can_leave_alone boolean NOT NULL DEFAULT false;
