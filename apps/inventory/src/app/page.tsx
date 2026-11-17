const handleCSVImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") return;

      const lines = text.split("\n");
      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        if (rawLine === undefined) continue;

        const line = rawLine.trim();
        if (!line) continue;

        const cols = line.split(",");
        const [rawSku = "", rawName = "", rawPrice = "100", rawStock = "50"] = cols.map((c) =>
          c.replace(/["']/g, "").trim()
        );

        if (!rawName) continue;

        const pSku = rawSku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
        const parsedPrice = Number(rawPrice);
        const pPrice = !Number.isNaN(parsedPrice) && parsedPrice >= 0 ? String(parsedPrice) : "100";
        const parsedStock = parseInt(rawStock, 10);
        const pStock = !Number.isNaN(parsedStock) && parsedStock >= 0 ? parsedStock : 50;

        try {
          const saved = await apiFetch<Product>("/products", {
            method: "POST",
            body: JSON.stringify({
              name: rawName,
              sku: pSku,
              price: pPrice,
              stockQty: pStock,
            }),
          });
          if (saved) {
            importedCount++;
          }
        } catch {
          // Skip failed row and continue importing remaining items
        }
      }

      // لوپ ختم ہونے کے بعد ایک بار الرٹ اور ریفریش آئے گا
      alert(`کامیابی کے ساتھ ${importedCount} پروڈکٹس امپورٹ ہو گئی ہیں!`);
      loadProducts();
    };
    reader.readAsText(file);
  };
