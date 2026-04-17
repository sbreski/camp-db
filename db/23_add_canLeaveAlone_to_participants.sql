-- Migration: Add canLeaveAlone column to participants
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS canLeaveAlone boolean NOT NULL DEFAULT false;
