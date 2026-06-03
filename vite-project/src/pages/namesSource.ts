import type { Item } from "composite-select";

const scientists = [
  "agnesi",
  "albattani",
  "allen",
  "almeida",
  "antonelli",
  "archimedes",
  "ardinghelli",
  "aryabhata",
  "austin",
  "babbage",
  "banach",
  "banzai",
  "bardeen",
  "bartik",
  "bassi",
  "beaver",
  "bell",
  "benz",
  "bhabha",
  "bhaskara",
  "black",
  "blackburn",
  "blackwell",
  "bohr",
  "booth",
  "borg",
  "bose",
  "bouman",
  "boyd",
  "brahmagupta",
  "brattain",
  "brown",
  "buck",
  "burnell",
  "cannon",
  "carson",
  "cartwright",
  "carver",
  "cerf",
  "chandrasekhar",
  "chaplygin",
  "chatelet",
  "chatterjee",
  "chaum",
  "chebyshev",
  "clarke",
  "cohen",
  "colden",
  "cori",
  "cray",
  "curie",
  "curran",
  "darwin",
  "davinci",
  "dewdney",
  "dhawan",
  "diffie",
  "dijkstra",
  "dirac",
  "driscoll",
  "dubinsky",
  "easley",
  "edison",
  "einstein",
  "elbakyan",
  "elgamal",
  "elion",
  "ellis",
  "engelbart",
  "euclid",
  "euler",
  "faraday",
  "feistel",
  "fermat",
  "fermi",
  "feynman",
  "franklin",
  "gagarin",
  "galileo",
  "galois",
  "ganguly",
  "gates",
  "gauss",
  "germain",
  "goldberg",
  "goldstine",
  "goldwasser",
  "golick",
  "goodall",
  "gould",
  "greider",
  "grothendieck",
  "haibt",
  "hamilton",
  "haslett",
  "hawking",
  "heisenberg",
  "hellman",
  "hermann",
  "herschel",
  "hertz",
  "heyrovsky",
  "hodgkin",
  "hofstadter",
  "hoover",
  "hopper",
  "hugle",
  "hypatia",
  "ishizaka",
  "jackson",
  "jang",
  "jemison",
  "jennings",
];

const offset = 10;

function randomIndex(arrayLength: number) {
  return Math.floor(Math.random() * arrayLength);
}

export function randomNames(name: string, num: number = 10): Item[] {
  const uq = new Set<number>();

  const buff: Item[] = [];

  while (true) {
    const rand = randomIndex(scientists.length);

    if (uq.has(rand)) {
      continue;
    }

    uq.add(rand);

    buff.push({ id: rand + offset, label: `${name}_${scientists[rand]}` });

    if (buff.length === num) {
      return buff;
    }
  }
}

export function searchNames(name: string | undefined, num: number = 10): Item[] {
  const buff: Item[] = [];

  let search = "";
  if (typeof name === "string") {
    search = name.trim();
  }

  for (let i = 0; i < scientists.length; i += 1) {
    const label = scientists[i];

    const match = search === "" || label.toLowerCase().includes(search.toLowerCase());

    if (match) {
      buff.push({ id: i + offset, label });
    }

    // if (num !== Infinity && buff.length === num) { // this is actually not needed
    if (buff.length === num) {
      return buff;
    }
  }

  return buff;
}
