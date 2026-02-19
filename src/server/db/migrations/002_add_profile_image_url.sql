-- Add profile_image_url column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS profile_image_url TEXT DEFAULT NULL;
