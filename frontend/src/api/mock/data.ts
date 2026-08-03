// Realistic local mock catalogue used in preview / offline / dev.
// Shapes match the normalised domain model exactly so the UI is identical to
// live. Prices are GBP minor units, VAT-inclusive style (mirrors WooCommerce).
// NOTE: neutral, non-medical product content only — no invented claims.

import type { Category, PriceInfo, Product } from "@/src/types/catalogue";

const gbp = (
  price: string,
  regular = price,
  sale = "",
): PriceInfo => ({
  price,
  regularPrice: regular,
  salePrice: sale,
  currencyMinorUnit: 2,
  currencySymbol: "£",
  currencyPrefix: "£",
  currencySuffix: "",
  currencyDecimalSeparator: ".",
  currencyThousandSeparator: ",",
  priceRange: null,
  taxLabel: "incl. VAT",
});

const img = (id: number, src: string, alt: string) => ({
  id,
  src,
  thumbnail: src,
  alt,
});

const IMG = {
  bottle: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80",
  bottle2: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80",
  jar: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80",
  powder: "https://images.unsplash.com/photo-1622485831129-1a8b0f0f4d3f?w=800&q=80",
  skincare: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80",
  skincare2: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80",
  gadget: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80",
  band: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800&q=80",
  bag: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
  tea: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&q=80",
};

export const MOCK_CATEGORIES: Category[] = [
  { id: 11, name: "Supplements", slug: "supplements", description: "Everyday supplements and wellness essentials.", count: 4, image: img(0, IMG.bottle, "Supplements"), parent: 0 },
  { id: 12, name: "Skincare", slug: "skincare", description: "Cleansers, serums and daily skincare.", count: 2, image: img(0, IMG.skincare, "Skincare"), parent: 0 },
  { id: 13, name: "Wellness", slug: "wellness", description: "Teas, powders and wellbeing products.", count: 2, image: img(0, IMG.tea, "Wellness"), parent: 0 },
  { id: 14, name: "Accessories", slug: "accessories", description: "Bottles, bands and daily accessories.", count: 2, image: img(0, IMG.gadget, "Accessories"), parent: 0 },
];

const simpleAttrs = { attributes: [], variations: [] as any[] };

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 101, parentId: 0, name: "Daily Multivitamin Complex", slug: "daily-multivitamin", permalink: "https://apeps.co.uk/product/daily-multivitamin",
    sku: "APS-MV-101", type: "simple",
    shortDescription: "<p>A balanced daily multivitamin in easy-to-take capsules.</p>",
    description: "<p>A balanced daily multivitamin providing a broad spectrum of vitamins and minerals.</p><ul><li>60 capsules</li><li>One a day</li><li>Suitable for adults</li></ul>",
    images: [img(1, IMG.bottle, "Multivitamin bottle"), img(2, IMG.bottle2, "Multivitamin bottle side")],
    prices: gbp("1499"), onSale: false, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "In stock", averageRating: "4.6", reviewCount: 128,
    categories: [{ id: 11, name: "Supplements", slug: "supplements" }], ...simpleAttrs, featured: true,
  },
  {
    id: 102, parentId: 0, name: "Omega-3 Fish Oil", slug: "omega-3-fish-oil", permalink: "https://apeps.co.uk/product/omega-3",
    sku: "APS-OM-102", type: "simple",
    shortDescription: "<p>High-strength Omega-3 softgels.</p>",
    description: "<p>High-strength Omega-3 fish oil softgels. 90 softgels per bottle.</p>",
    images: [img(3, IMG.bottle2, "Omega 3 bottle")],
    prices: gbp("1200", "1800", "1200"), onSale: true, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: 5, soldIndividually: false, stockText: "Only 5 left in stock", averageRating: "4.8", reviewCount: 96,
    categories: [{ id: 11, name: "Supplements", slug: "supplements" }], ...simpleAttrs, featured: true,
  },
  {
    id: 103, parentId: 0, name: "Vitamin D3 Drops", slug: "vitamin-d3-drops", permalink: "https://apeps.co.uk/product/vitamin-d3",
    sku: "APS-D3-103", type: "simple",
    shortDescription: "<p>Vitamin D3 in convenient liquid drops.</p>",
    description: "<p>Vitamin D3 liquid drops, 30ml.</p>",
    images: [img(4, IMG.bottle, "Vitamin D3 drops")],
    prices: gbp("899"), onSale: false, isInStock: false, isPurchasable: false, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "Out of stock", averageRating: "4.4", reviewCount: 42,
    categories: [{ id: 11, name: "Supplements", slug: "supplements" }], ...simpleAttrs, featured: false,
  },
  {
    id: 104, parentId: 0, name: "Protein Powder", slug: "protein-powder", permalink: "https://apeps.co.uk/product/protein-powder",
    sku: "APS-PP-104", type: "variable",
    shortDescription: "<p>Smooth protein powder. Choose your flavour and size.</p>",
    description: "<p>Protein powder available in multiple flavours and sizes.</p>",
    images: [img(5, IMG.powder, "Protein powder tub"), img(6, IMG.jar, "Protein powder scoop")],
    prices: { ...gbp("2499"), priceRange: { minAmount: "2499", maxAmount: "3999" } },
    onSale: false, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "In stock", averageRating: "4.7", reviewCount: 210,
    categories: [{ id: 11, name: "Supplements", slug: "supplements" }],
    attributes: [
      { id: 1, name: "Flavour", taxonomy: "pa_flavour", hasVariations: true, terms: [
        { id: 1, name: "Vanilla", slug: "vanilla" }, { id: 2, name: "Chocolate", slug: "chocolate" }] },
      { id: 2, name: "Size", taxonomy: "pa_size", hasVariations: true, terms: [
        { id: 3, name: "500g", slug: "500g" }, { id: 4, name: "1kg", slug: "1kg" }] },
    ],
    variations: [
      { id: 10401, attributes: { Flavour: "Vanilla", Size: "500g" } },
      { id: 10402, attributes: { Flavour: "Vanilla", Size: "1kg" } },
      { id: 10403, attributes: { Flavour: "Chocolate", Size: "500g" } },
      { id: 10404, attributes: { Flavour: "Chocolate", Size: "1kg" } },
    ],
    featured: true,
  },
  {
    id: 201, parentId: 0, name: "Gentle Cleansing Gel", slug: "cleansing-gel", permalink: "https://apeps.co.uk/product/cleansing-gel",
    sku: "APS-CG-201", type: "simple",
    shortDescription: "<p>A gentle daily facial cleanser.</p>",
    description: "<p>A gentle daily facial cleansing gel, 200ml.</p>",
    images: [img(7, IMG.skincare, "Cleansing gel")],
    prices: gbp("1650"), onSale: false, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "In stock", averageRating: "4.5", reviewCount: 61,
    categories: [{ id: 12, name: "Skincare", slug: "skincare" }], ...simpleAttrs, featured: false,
  },
  {
    id: 202, parentId: 0, name: "Hydrating Serum", slug: "hydrating-serum", permalink: "https://apeps.co.uk/product/hydrating-serum",
    sku: "APS-HS-202", type: "simple",
    shortDescription: "<p>Lightweight hydrating serum for daily use.</p>",
    description: "<p>Lightweight hydrating serum, 30ml.</p>",
    images: [img(8, IMG.skincare2, "Hydrating serum")],
    prices: gbp("2200", "2800", "2200"), onSale: true, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "In stock", averageRating: "4.9", reviewCount: 154,
    categories: [{ id: 12, name: "Skincare", slug: "skincare" }], ...simpleAttrs, featured: true,
  },
  {
    id: 301, parentId: 0, name: "Herbal Wellness Tea", slug: "wellness-tea", permalink: "https://apeps.co.uk/product/wellness-tea",
    sku: "APS-WT-301", type: "simple",
    shortDescription: "<p>Caffeine-free herbal tea blend, 20 bags.</p>",
    description: "<p>A caffeine-free herbal tea blend. 20 biodegradable tea bags.</p>",
    images: [img(9, IMG.tea, "Herbal tea")],
    prices: gbp("650"), onSale: false, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "In stock", averageRating: "4.3", reviewCount: 33,
    categories: [{ id: 13, name: "Wellness", slug: "wellness" }], ...simpleAttrs, featured: false,
  },
  {
    id: 302, parentId: 0, name: "Greens Superfood Powder", slug: "greens-powder", permalink: "https://apeps.co.uk/product/greens-powder",
    sku: "APS-GP-302", type: "simple",
    shortDescription: "<p>A blend of greens in a convenient powder.</p>",
    description: "<p>A blend of greens superfood powder, 300g.</p>",
    images: [img(10, IMG.jar, "Greens powder")],
    prices: gbp("2999"), onSale: false, isInStock: true, isPurchasable: true, isOnBackorder: true,
    lowStockRemaining: null, soldIndividually: false, stockText: "Available on backorder", averageRating: "4.2", reviewCount: 18,
    categories: [{ id: 13, name: "Wellness", slug: "wellness" }], ...simpleAttrs, featured: false,
  },
  {
    id: 401, parentId: 0, name: "Insulated Water Bottle", slug: "water-bottle", permalink: "https://apeps.co.uk/product/water-bottle",
    sku: "APS-WB-401", type: "variable",
    shortDescription: "<p>Stainless steel insulated bottle. Choose a colour.</p>",
    description: "<p>Stainless steel insulated water bottle, 750ml.</p>",
    images: [img(11, IMG.gadget, "Water bottle")],
    prices: { ...gbp("1899"), priceRange: { minAmount: "1899", maxAmount: "1899" } },
    onSale: false, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: null, soldIndividually: false, stockText: "In stock", averageRating: "4.6", reviewCount: 74,
    categories: [{ id: 14, name: "Accessories", slug: "accessories" }],
    attributes: [
      { id: 3, name: "Colour", taxonomy: "pa_colour", hasVariations: true, terms: [
        { id: 5, name: "Black", slug: "black" }, { id: 6, name: "Blue", slug: "blue" }, { id: 7, name: "Silver", slug: "silver" }] },
    ],
    variations: [
      { id: 40101, attributes: { Colour: "Black" } },
      { id: 40102, attributes: { Colour: "Blue" } },
      { id: 40103, attributes: { Colour: "Silver" } },
    ],
    featured: false,
  },
  {
    id: 402, parentId: 0, name: "Resistance Band Set", slug: "resistance-bands", permalink: "https://apeps.co.uk/product/resistance-bands",
    sku: "APS-RB-402", type: "simple",
    shortDescription: "<p>Set of 3 resistance bands with carry bag.</p>",
    description: "<p>Set of 3 resistance bands (light, medium, heavy) with a carry bag.</p>",
    images: [img(12, IMG.band, "Resistance bands"), img(13, IMG.bag, "Carry bag")],
    prices: gbp("1250", "1600", "1250"), onSale: true, isInStock: true, isPurchasable: true, isOnBackorder: false,
    lowStockRemaining: 3, soldIndividually: false, stockText: "Only 3 left in stock", averageRating: "4.5", reviewCount: 57,
    categories: [{ id: 14, name: "Accessories", slug: "accessories" }], ...simpleAttrs, featured: false,
  },
];

// Variation-level detail (price / stock per variation) used on the product page.
export const MOCK_VARIATIONS: Record<number, Product["prices"] & { isInStock: boolean; stock: string }> = {};

export const MOCK_VARIATION_DETAILS = {
  10401: { attributes: { Flavour: "Vanilla", Size: "500g" }, prices: gbp("2499"), isInStock: true, stockText: "In stock" },
  10402: { attributes: { Flavour: "Vanilla", Size: "1kg" }, prices: gbp("3999"), isInStock: true, stockText: "In stock" },
  10403: { attributes: { Flavour: "Chocolate", Size: "500g" }, prices: gbp("2499"), isInStock: true, stockText: "In stock" },
  10404: { attributes: { Flavour: "Chocolate", Size: "1kg" }, prices: gbp("3999"), isInStock: false, stockText: "Out of stock" },
  40101: { attributes: { Colour: "Black" }, prices: gbp("1899"), isInStock: true, stockText: "In stock" },
  40102: { attributes: { Colour: "Blue" }, prices: gbp("1899"), isInStock: true, stockText: "In stock" },
  40103: { attributes: { Colour: "Silver" }, prices: gbp("1899"), isInStock: false, stockText: "Out of stock" },
} as const;
