-- Deterministic local seed data for API and chat flow testing.
-- Safe to re-run: targeted delete + reinsert for known sample titles.

BEGIN;

DELETE FROM public.properties
WHERE title IN (
    'Sea View Heights',
    'Palm Residency',
    'Harbor Enclave',
    'Green Valley Villas',
    'Tech Park Plaza',
    'Ocean Breeze Apartments',
    'Sunrise Gardens'
);

INSERT INTO public.properties (title, location, price, bhk, type, status, description, is_available)
VALUES
    (
        'Sea View Heights',
        'madhurawada',
        6500000,
        '2BHK',
        'apartment',
        'available',
        'Primary deterministic match for 2BHK apartment in madhurawada budget tests.',
        true
    ),
    (
        'Palm Residency',
        'madhurawada',
        7200000,
        '3BHK',
        'apartment',
        'available',
        'Used to validate retry path when BHK filter is relaxed.',
        true
    ),
    (
        'Harbor Enclave',
        'mvp colony',
        5600000,
        '2BHK',
        'apartment',
        'available',
        'Alternative apartment inventory for broader location fallback checks.',
        true
    ),
    (
        'Green Valley Villas',
        'anandapuram',
        9800000,
        '3BHK',
        'villa',
        'available',
        'Non-apartment inventory for property_type filtering checks.',
        true
    ),
    (
        'Tech Park Plaza',
        'gajuwaka',
        8300000,
        NULL,
        'commercial',
        'available',
        'Commercial inventory for intent/path testing.',
        true
    ),
    (
        'Ocean Breeze Apartments',
        'madhurawada',
        6100000,
        '2BHK',
        'apartment',
        'sold',
        'Unavailable row to ensure is_available filtering is respected.',
        false
    ),
    (
        'Sunrise Gardens',
        'yendada',
        4800000,
        '2BHK',
        'apartment',
        'available',
        'Lower-budget apartment to test price range matching behavior.',
        true
    );

COMMIT;
