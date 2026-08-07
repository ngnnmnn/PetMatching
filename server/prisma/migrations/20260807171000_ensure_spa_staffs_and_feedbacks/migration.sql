CREATE TABLE IF NOT EXISTS public.spa_staff (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    address_spa_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT spa_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT spa_staff_address_spa_id_fkey FOREIGN KEY (address_spa_id) REFERENCES public.address_spas(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS public.spa_feedbacks (
    id TEXT NOT NULL PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    rate_staff INT NOT NULL,
    rate_services INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT spa_feedbacks_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.spa_bookings(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT spa_feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
