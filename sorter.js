// Same logic as propose() in sort_posts.py. Rules come from rules.js, which gen_rules.py generates.
(() => {
  const R = globalThis.SS_RULES;
  const rx = p => new RegExp(p, "i");
  const PLACE = Object.entries(R.place).map(([k, p]) => [k, rx(p)]);
  const TOPIC = Object.entries(R.topic).map(([k, p]) => [k, rx(p)]);
  const RECIPE = rx(R.recipe);
  const FOOD = new Set(R.food);

  globalThis.ssPropose = post => {
    const cap = post.caption || "";
    const text = `${post.user || ""} ${post.name || ""} ${cap}`;
    const loc = post.location || {};
    const locText = `${loc.name || ""} ${loc.city || ""}`;
    const isRecipe = RECIPE.test(cap);
    let hits = TOPIC.filter(([, r]) => r.test(text)).map(([k]) => k);
    const food = isRecipe || hits.some(k => FOOD.has(k));
    hits = hits.filter(k => (k !== "easy" && k !== "healthy") || food);
    const foodish = new Set([...FOOD, "easy", "healthy", "matcha", "drinks"]);
    if (isRecipe && !hits.some(k => foodish.has(k))) hits.push("dinner");
    const places = PLACE.filter(([, r]) => r.test(locText) || (!isRecipe && r.test(cap))).map(([k]) => k);
    const topics = R.order.filter(k => hits.includes(k)).slice(0, 2);
    const albums = [...new Set([...places.slice(0, 1), ...topics].map(a => R.merge[a] || a))];
    if (albums.length) return albums;
    return cap.length < 40 ? ["funny"] : ["lifestyle"];
  };
})();
