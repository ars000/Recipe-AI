-- CreateTable
CREATE TABLE "ShoppingListItemSource" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "ShoppingListItemSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingListItemSource_recipeId_idx" ON "ShoppingListItemSource"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListItemSource_itemId_recipeId_key" ON "ShoppingListItemSource"("itemId", "recipeId");

-- AddForeignKey
ALTER TABLE "ShoppingListItemSource" ADD CONSTRAINT "ShoppingListItemSource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShoppingListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItemSource" ADD CONSTRAINT "ShoppingListItemSource_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
