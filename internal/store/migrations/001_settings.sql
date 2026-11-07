CREATE TABLE settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 distance_unit text NOT NULL DEFAULT 'km' CHECK(distance_unit IN ('km','mi')),
 fuel_unit text NOT NULL DEFAULT 'L' CHECK(fuel_unit IN ('L','US gal','Imp gal')),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency ~ '^[A-Z]{3}$'),
 timezone text NOT NULL DEFAULT 'Europe/Berlin'
);
INSERT INTO settings(singleton) VALUES(true);
