const consumables = require("./shop/consumables");
const swordsmanItems = require("./shop/swordsmanItems");
const archerItems = require("./shop/archerItems");
const assassinItems = require("./shop/assassinItems");
const tankerItems = require("./shop/tankerItems");

const shopItems = [
  ...consumables,
  ...swordsmanItems,
  ...archerItems,
  ...assassinItems,
  ...tankerItems,
];

module.exports = shopItems;