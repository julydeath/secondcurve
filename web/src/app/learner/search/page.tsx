const mentors = [
  {
    name: "Dr. Asha Rao",
    expertise: "Career & Higher Education",
    rating: "4.9",
    price: "₹1,800",
    languages: ["English", "Hindi"],
  },
  {
    name: "Capt. R. Singh",
    expertise: "Leadership & Discipline",
    rating: "4.8",
    price: "₹2,200",
    languages: ["English", "Punjabi"],
  },
  {
    name: "S. Narayanan",
    expertise: "Finance & Banking",
    rating: "4.7",
    price: "₹1,500",
    languages: ["English", "Tamil"],
  },
];

export default function LearnerSearch() {
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="ink-border h-fit p-6">
        <h2 className="newsprint-title text-sm">Filters</h2>
        <div className="mt-4 space-y-4 text-sm text-[var(--ink-700)]">
          <label className="flex flex-col gap-2">
            Expertise
            <input
              className="ink-border px-3 py-2"
              placeholder="Banking, IT, Agriculture"
            />
          </label>
          <label className="flex flex-col gap-2">
            Price Range (₹)
            <div className="flex gap-2">
              <input
                className="w-full ink-border px-3 py-2"
                placeholder="500"
              />
              <input
                className="w-full ink-border px-3 py-2"
                placeholder="3000"
              />
            </div>
          </label>
          <label className="flex flex-col gap-2">
            Language
            <select className="ink-border px-3 py-2">
              <option>English</option>
              <option>Hindi</option>
              <option>Marathi</option>
              <option>Tamil</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            Experience (years)
            <input
              className="ink-border px-3 py-2"
              placeholder="10+"
            />
          </label>
          <label className="flex flex-col gap-2">
            Availability
            <input
              type="date"
              className="ink-border px-3 py-2"
            />
          </label>
        </div>
        <button className="mt-6 w-full border-2 border-black px-4 py-3 text-xs uppercase tracking-widest">
          Apply Filters
        </button>
      </aside>

      <section className="space-y-6">
        <div className="ink-border p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="newsprint-title text-lg">
                120 mentors available
              </h2>
              <p className="text-sm text-[var(--ink-700)]">
                Hand‑verified professionals across India.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="chip">Top Rated</button>
              <button className="chip">Lowest Price</button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {mentors.map((mentor) => (
            <div key={mentor.name} className="ink-border p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{mentor.name}</h3>
                <span className="chip">{mentor.rating} ★</span>
              </div>
              <p className="mt-2 text-sm text-[var(--ink-700)]">
                {mentor.expertise}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {mentor.languages.map((lang) => (
                  <span key={lang} className="chip">
                    {lang}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-base font-semibold">
                  {mentor.price} / session
                </p>
                <button className="border-2 border-black px-4 py-2 text-xs uppercase tracking-widest">
                  View Slots
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
