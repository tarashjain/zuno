// Imposter word pairs. Each round, everyone gets `word` except the imposter, who
// gets `pairWord` — close enough to describe without giving themselves away.
export const IMPOSTER_PAIRS: [string, string][] = [
  // Nature
  ["Ocean", "Lake"], ["Mountain", "Hill"], ["River", "Stream"], ["Forest", "Jungle"],
  ["Desert", "Prairie"], ["Storm", "Hurricane"], ["Snow", "Hail"], ["Volcano", "Geyser"],
  ["Cave", "Tunnel"], ["Island", "Peninsula"], ["Valley", "Canyon"], ["Cliff", "Ridge"],
  ["Meadow", "Field"], ["Pond", "Puddle"], ["Waterfall", "Rapids"],

  // Animals
  ["Alligator", "Crocodile"], ["Frog", "Toad"], ["Butterfly", "Moth"],
  ["Turtle", "Tortoise"], ["Dolphin", "Porpoise"], ["Rabbit", "Hare"],
  ["Crow", "Raven"], ["Sparrow", "Finch"], ["Bee", "Wasp"], ["Camel", "Llama"],

  // Food & drink
  ["Pizza", "Burger"], ["Taco", "Burrito"], ["Cookie", "Biscuit"], ["Pancake", "Waffle"],
  ["Soup", "Stew"], ["Cake", "Pie"], ["Donut", "Bagel"], ["Sandwich", "Wrap"],
  ["Cheese", "Butter"], ["Jam", "Jelly"], ["Ketchup", "Mustard"], ["Chips", "Fries"],
  ["Candy", "Chocolate"], ["Beer", "Wine"], ["Soda", "Juice"], ["Milkshake", "Smoothie"],
  ["Water", "Sparkling Water"], ["Tea", "Coffee"],

  // Places
  ["School", "University"], ["Hospital", "Clinic"], ["Library", "Bookstore"],
  ["Theater", "Cinema"], ["Restaurant", "Cafe"], ["Hotel", "Motel"],
  ["Museum", "Gallery"], ["Church", "Temple"], ["Airport", "Train Station"],
  ["Mall", "Market"], ["Gym", "Yoga Studio"], ["Zoo", "Aquarium"],
  ["Park", "Garden"], ["Office", "Studio"], ["Bakery", "Deli"],

  // Objects & furniture
  ["Sofa", "Armchair"], ["Clock", "Watch"], ["Bridge", "Tunnel"], ["Table", "Desk"],
  ["Blanket", "Quilt"], ["Mirror", "Window"], ["Candle", "Lantern"],
  ["Backpack", "Suitcase"], ["Umbrella", "Raincoat"], ["Pillow", "Cushion"],
  ["Rope", "String"], ["Broom", "Mop"], ["Ladder", "Staircase"], ["Basket", "Bag"],
  ["Vase", "Pot"],

  // Transport
  ["Car", "Truck"], ["Bicycle", "Motorcycle"], ["Bus", "Train"], ["Boat", "Ship"],
  ["Plane", "Helicopter"], ["Scooter", "Skateboard"], ["Subway", "Tram"],
  ["Taxi", "Rideshare"],

  // Instruments
  ["Guitar", "Violin"], ["Piano", "Keyboard"], ["Drum", "Tambourine"],
  ["Flute", "Clarinet"], ["Trumpet", "Trombone"], ["Harp", "Lyre"],

  // Sports & games
  ["Soccer", "Rugby"], ["Basketball", "Volleyball"], ["Tennis", "Badminton"],
  ["Chess", "Checkers"], ["Baseball", "Cricket"], ["Boxing", "Wrestling"],
  ["Golf", "Mini Golf"], ["Swimming", "Diving"],

  // Professions
  ["Doctor", "Nurse"], ["Teacher", "Professor"], ["Chef", "Baker"],
  ["Police Officer", "Security Guard"], ["Pilot", "Astronaut"], ["Lawyer", "Judge"],
  ["Painter", "Sculptor"], ["Photographer", "Videographer"],

  // Tech
  ["Phone", "Tablet"], ["Laptop", "Desktop"], ["TV", "Monitor"],
  ["Camera", "Camcorder"], ["Headphones", "Earbuds"], ["Printer", "Scanner"],

  // Weather
  ["Rain", "Drizzle"], ["Snow", "Sleet"], ["Fog", "Mist"], ["Thunder", "Lightning"],

  // Clothing
  ["Jacket", "Coat"], ["Shirt", "Blouse"], ["Shoes", "Sneakers"], ["Hat", "Cap"],
  ["Scarf", "Shawl"], ["Gloves", "Mittens"],
]
