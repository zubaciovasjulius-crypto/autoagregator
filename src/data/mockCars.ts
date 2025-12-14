export interface CarListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel: string;
  transmission: string;
  location: string;
  country: string;
  source: string;
  sourceUrl: string;
  image: string;
  listingUrl: string;
}

export const carBrands = [
  'Audi', 'BMW', 'Mercedes-Benz', 'Porsche', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];

export const europeanCountries = [
  'Lietuva', 'Vokietija', 'Nyderlandai'
];

export const carSources = [
  { name: 'Mobile.de', country: 'Vokietija', id: 'mobile.de', url: 'https://mobile.de' },
  { name: 'AutoScout24', country: 'Vokietija', id: 'autoscout24', url: 'https://autoscout24.de' },
  { name: 'Autoplius.lt', country: 'Lietuva', id: 'autoplius', url: 'https://autoplius.lt' },
  { name: 'Kleinanzeigen', country: 'Vokietija', id: 'kleinanzeigen', url: 'https://kleinanzeigen.de' },
  { name: 'Marktplaats', country: 'Nyderlandai', id: 'marktplaats', url: 'https://marktplaats.nl' },
];

// Real car images by brand from Unsplash
const carImages: Record<string, string[]> = {
  BMW: [
    'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80',
    'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=600&q=80',
    'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=600&q=80',
  ],
  'Mercedes-Benz': [
    'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600&q=80',
    'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=600&q=80',
  ],
  Audi: [
    'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600&q=80',
    'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=600&q=80',
  ],
  Volkswagen: [
    'https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=600&q=80',
    'https://images.unsplash.com/photo-1622659688643-1ecb37506817?w=600&q=80',
  ],
  Porsche: [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80',
    'https://images.unsplash.com/photo-1614200179396-2bdb77ebf81b?w=600&q=80',
  ],
  Tesla: [
    'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&q=80',
    'https://images.unsplash.com/photo-1561580125-028ee3bd62eb?w=600&q=80',
  ],
  Toyota: [
    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=600&q=80',
  ],
  Volvo: [
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=80',
  ],
};

const getImageForBrand = (brand: string) => {
  const images = carImages[brand] || Object.values(carImages).flat();
  return images[Math.floor(Math.random() * images.length)];
};

export const mockCars: CarListing[] = [
  // Mobile.de - Vokietija
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
    listingUrl: 'https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=3500&ref=quickSearch&sfmr=false&vc=Car',
    image: carImages.BMW[0],
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
    source: 'Mobile.de',
    sourceUrl: 'https://mobile.de',
    listingUrl: 'https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=17200&ref=quickSearch&sfmr=false&vc=Car',
    image: carImages['Mercedes-Benz'][0],
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
    location: 'Hamburgas',
    country: 'Vokietija',
    source: 'Mobile.de',
    sourceUrl: 'https://mobile.de',
    listingUrl: 'https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&ms=1900&ref=quickSearch&sfmr=false&vc=Car',
    image: carImages.Audi[0],
  },
  // AutoScout24
  {
    id: '4',
    title: 'BMW X5 xDrive40d M Sport',
    brand: 'BMW',
    model: 'X5',
    year: 2021,
    price: 68900,
    mileage: 45000,
    fuel: 'Dyzelinas',
    transmission: 'Automatinė',
    location: 'Štutgartas',
    country: 'Vokietija',
    source: 'AutoScout24',
    sourceUrl: 'https://autoscout24.de',
    listingUrl: 'https://www.autoscout24.de/lst/bmw/x5?sort=standard&desc=0',
    image: carImages.BMW[1],
  },
  {
    id: '5',
    title: 'Porsche Cayenne S',
    brand: 'Porsche',
    model: 'Cayenne',
    year: 2020,
    price: 79500,
    mileage: 52000,
    fuel: 'Benzinas',
    transmission: 'Automatinė',
    location: 'Diuseldorfas',
    country: 'Vokietija',
    source: 'AutoScout24',
    sourceUrl: 'https://autoscout24.de',
    listingUrl: 'https://www.autoscout24.de/lst/porsche/cayenne?sort=standard&desc=0',
    image: carImages.Porsche[0],
  },
  // Autoplius.lt - Lietuva
  {
    id: '6',
    title: 'Volkswagen Passat B8 2.0 TDI',
    brand: 'Volkswagen',
    model: 'Passat',
    year: 2018,
    price: 18500,
    mileage: 145000,
    fuel: 'Dyzelinas',
    transmission: 'Automatinė',
    location: 'Vilnius',
    country: 'Lietuva',
    source: 'Autoplius.lt',
    sourceUrl: 'https://autoplius.lt',
    listingUrl: 'https://autoplius.lt/skelbimai/naudoti-automobiliai?make_id=79&model_id=800',
    image: carImages.Volkswagen[0],
  },
  {
    id: '7',
    title: 'Toyota RAV4 Hybrid AWD',
    brand: 'Toyota',
    model: 'RAV4',
    year: 2021,
    price: 35900,
    mileage: 58000,
    fuel: 'Hibridas',
    transmission: 'Automatinė',
    location: 'Kaunas',
    country: 'Lietuva',
    source: 'Autoplius.lt',
    sourceUrl: 'https://autoplius.lt',
    listingUrl: 'https://autoplius.lt/skelbimai/naudoti-automobiliai?make_id=76&model_id=3284',
    image: carImages.Toyota[0],
  },
  {
    id: '8',
    title: 'BMW 320d Touring',
    brand: 'BMW',
    model: '320d',
    year: 2019,
    price: 24500,
    mileage: 98000,
    fuel: 'Dyzelinas',
    transmission: 'Automatinė',
    location: 'Klaipėda',
    country: 'Lietuva',
    source: 'Autoplius.lt',
    sourceUrl: 'https://autoplius.lt',
    listingUrl: 'https://autoplius.lt/skelbimai/naudoti-automobiliai?make_id=9&model_id=57',
    image: carImages.BMW[2],
  },
  // Kleinanzeigen
  {
    id: '9',
    title: 'Volkswagen Golf GTI',
    brand: 'Volkswagen',
    model: 'Golf GTI',
    year: 2021,
    price: 32900,
    mileage: 42000,
    fuel: 'Benzinas',
    transmission: 'Automatinė',
    location: 'Berlynas',
    country: 'Vokietija',
    source: 'Kleinanzeigen',
    sourceUrl: 'https://kleinanzeigen.de',
    listingUrl: 'https://www.kleinanzeigen.de/s-autos/volkswagen/golf/c216',
    image: carImages.Volkswagen[1],
  },
  {
    id: '10',
    title: 'Audi A4 Avant 2.0 TDI',
    brand: 'Audi',
    model: 'A4 Avant',
    year: 2020,
    price: 28900,
    mileage: 76000,
    fuel: 'Dyzelinas',
    transmission: 'Automatinė',
    location: 'Hamburgas',
    country: 'Vokietija',
    source: 'Kleinanzeigen',
    sourceUrl: 'https://kleinanzeigen.de',
    listingUrl: 'https://www.kleinanzeigen.de/s-autos/audi/a4/c216',
    image: carImages.Audi[1],
  },
  // Marktplaats - Nyderlandai
  {
    id: '11',
    title: 'Tesla Model 3 Long Range',
    brand: 'Tesla',
    model: 'Model 3',
    year: 2022,
    price: 42900,
    mileage: 35000,
    fuel: 'Elektra',
    transmission: 'Automatinė',
    location: 'Amsterdamas',
    country: 'Nyderlandai',
    source: 'Marktplaats',
    sourceUrl: 'https://marktplaats.nl',
    listingUrl: 'https://www.marktplaats.nl/l/auto-s/tesla/',
    image: carImages.Tesla[0],
  },
  {
    id: '12',
    title: 'Volvo XC60 T8 Recharge',
    brand: 'Volvo',
    model: 'XC60',
    year: 2022,
    price: 54900,
    mileage: 28000,
    fuel: 'Hibridas',
    transmission: 'Automatinė',
    location: 'Roterdamas',
    country: 'Nyderlandai',
    source: 'Marktplaats',
    sourceUrl: 'https://marktplaats.nl',
    listingUrl: 'https://www.marktplaats.nl/l/auto-s/volvo/',
    image: carImages.Volvo[0],
  },
  {
    id: '13',
    title: 'BMW 330e iPerformance',
    brand: 'BMW',
    model: '330e',
    year: 2021,
    price: 45500,
    mileage: 42000,
    fuel: 'Hibridas',
    transmission: 'Automatinė',
    location: 'Utrechtas',
    country: 'Nyderlandai',
    source: 'Marktplaats',
    sourceUrl: 'https://marktplaats.nl',
    listingUrl: 'https://www.marktplaats.nl/l/auto-s/bmw/',
    image: carImages.BMW[0],
  },
  {
    id: '14',
    title: 'Porsche Taycan 4S',
    brand: 'Porsche',
    model: 'Taycan',
    year: 2022,
    price: 89900,
    mileage: 22000,
    fuel: 'Elektra',
    transmission: 'Automatinė',
    location: 'Haga',
    country: 'Nyderlandai',
    source: 'Marktplaats',
    sourceUrl: 'https://marktplaats.nl',
    listingUrl: 'https://www.marktplaats.nl/l/auto-s/porsche/',
    image: carImages.Porsche[1],
  },
];
