export interface CarListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel: 'Benzinas' | 'Dyzelinas' | 'Elektra' | 'Hibridas';
  transmission: 'Automatinė' | 'Mechaninė';
  location: string;
  country: string;
  source: string;
  sourceUrl: string;
  image: string;
  power: number;
  addedDate: string;
}

export const carBrands = [
  'Audi', 'BMW', 'Mercedes-Benz', 'Volkswagen', 'Toyota', 'Honda', 
  'Ford', 'Opel', 'Skoda', 'Volvo', 'Porsche', 'Tesla'
];

export const europeanCountries = [
  'Lietuva', 'Latvija', 'Estija', 'Lenkija', 'Vokietija', 
  'Prancūzija', 'Italija', 'Ispanija', 'Nyderlandai', 'Belgija'
];

export const carSources = [
  { name: 'Autoplius.lt', country: 'Lietuva' },
  { name: 'Mobile.de', country: 'Vokietija' },
  { name: 'AutoScout24', country: 'Vokietija' },
  { name: 'OtoMoto.pl', country: 'Lenkija' },
  { name: 'SS.lv', country: 'Latvija' },
  { name: 'Auto24.ee', country: 'Estija' },
];

export const mockCars: CarListing[] = [
  {
    id: '1',
    title: 'BMW 530d xDrive M Sport',
    brand: 'BMW',
    model: '530d',
    year: 2021,
    price: 45900,
    mileage: 67000,
    fuel: 'Dyzelinas',
    transmission: 'Automatinė',
    location: 'Miunchenas',
    country: 'Vokietija',
    source: 'Mobile.de',
    sourceUrl: 'https://mobile.de',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
    power: 286,
    addedDate: '2024-01-10',
  },
  {
    id: '2',
    title: 'Mercedes-Benz E220d AMG Line',
    brand: 'Mercedes-Benz',
    model: 'E220d',
    year: 2020,
    price: 38500,
    mileage: 89000,
    fuel: 'Dyzelinas',
    transmission: 'Automatinė',
    location: 'Berlynas',
    country: 'Vokietija',
    source: 'AutoScout24',
    sourceUrl: 'https://autoscout24.de',
    image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80',
    power: 194,
    addedDate: '2024-01-09',
  },
  {
    id: '3',
    title: 'Audi A6 Avant 45 TFSI quattro',
    brand: 'Audi',
    model: 'A6 Avant',
    year: 2022,
    price: 52000,
    mileage: 34000,
    fuel: 'Benzinas',
    transmission: 'Automatinė',
    location: 'Vilnius',
    country: 'Lietuva',
    source: 'Autoplius.lt',
    sourceUrl: 'https://autoplius.lt',
    image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80',
    power: 265,
    addedDate: '2024-01-08',
  },
  {
    id: '4',
    title: 'Volkswagen Golf GTI',
    brand: 'Volkswagen',
    model: 'Golf GTI',
    year: 2021,
    price: 32900,
    mileage: 45000,
    fuel: 'Benzinas',
    transmission: 'Automatinė',
    location: 'Varšuva',
    country: 'Lenkija',
    source: 'OtoMoto.pl',
    sourceUrl: 'https://otomoto.pl',
    image: 'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=800&q=80',
    power: 245,
    addedDate: '2024-01-07',
  },
  {
    id: '5',
    title: 'Tesla Model 3 Long Range',
    brand: 'Tesla',
    model: 'Model 3',
    year: 2023,
    price: 41000,
    mileage: 15000,
    fuel: 'Elektra',
    transmission: 'Automatinė',
    location: 'Amsterdamas',
    country: 'Nyderlandai',
    source: 'AutoScout24',
    sourceUrl: 'https://autoscout24.nl',
    image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80',
    power: 440,
    addedDate: '2024-01-06',
  },
  {
    id: '6',
    title: 'Porsche Taycan 4S',
    brand: 'Porsche',
    model: 'Taycan',
    year: 2022,
    price: 89900,
    mileage: 28000,
    fuel: 'Elektra',
    transmission: 'Automatinė',
    location: 'Štutgartas',
    country: 'Vokietija',
    source: 'Mobile.de',
    sourceUrl: 'https://mobile.de',
    image: 'https://images.unsplash.com/photo-1614200179396-2bdb77ebf81b?w=800&q=80',
    power: 530,
    addedDate: '2024-01-05',
  },
  {
    id: '7',
    title: 'Volvo XC60 T6 AWD Inscription',
    brand: 'Volvo',
    model: 'XC60',
    year: 2021,
    price: 44500,
    mileage: 52000,
    fuel: 'Hibridas',
    transmission: 'Automatinė',
    location: 'Ryga',
    country: 'Latvija',
    source: 'SS.lv',
    sourceUrl: 'https://ss.lv',
    image: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80',
    power: 340,
    addedDate: '2024-01-04',
  },
  {
    id: '8',
    title: 'Skoda Octavia RS iV',
    brand: 'Skoda',
    model: 'Octavia RS',
    year: 2022,
    price: 36900,
    mileage: 41000,
    fuel: 'Hibridas',
    transmission: 'Automatinė',
    location: 'Talinas',
    country: 'Estija',
    source: 'Auto24.ee',
    sourceUrl: 'https://auto24.ee',
    image: 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80',
    power: 245,
    addedDate: '2024-01-03',
  },
];
