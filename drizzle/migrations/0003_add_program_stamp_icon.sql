ALTER TABLE public.loyalty_programs
ADD COLUMN stamp_icon text NOT NULL DEFAULT 'stamp';

ALTER TABLE public.loyalty_programs
ADD CONSTRAINT loyalty_programs_stamp_icon_valid
CHECK (stamp_icon IN ('coffee', 'stamp', 'scissors', 'food', 'gift', 'star'));