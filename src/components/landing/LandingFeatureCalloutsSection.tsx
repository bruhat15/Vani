import { motion } from "framer-motion";

const features = [
  {
    title: "Notebook memory",
    body: "Each notebook keeps context across sessions so every follow-up starts from understanding, not reset.",
  },
  {
    title: "Citation aware chat",
    body: "Responses include source references that connect answers to line-level evidence.",
  },
  {
    title: "Voice native controls",
    body: "Switch between listening and speaking states with responsive visual feedback.",
  },
];

const LandingFeatureCalloutsSection = () => {
  return (
    <section className="bg-[var(--color-paper)] px-6 pb-24 text-[var(--color-ink)]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <motion.article
            key={feature.title}
            className="relative overflow-hidden rounded-2xl border border-[var(--color-mist)] bg-white p-6"
            initial="rest"
            whileHover="hover"
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <motion.rect
                x="0.75"
                y="0.75"
                width="98.5"
                height="98.5"
                rx="6"
                fill="none"
                stroke="var(--color-saffron)"
                strokeWidth="1"
                pathLength={1}
                strokeDasharray={1}
                variants={{
                  rest: {
                    strokeDashoffset: 1,
                    opacity: 0,
                  },
                  hover: {
                    strokeDashoffset: 0,
                    opacity: 1,
                  },
                }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              />
            </svg>
            <h3 className="mb-3 text-2xl">{feature.title}</h3>
            <p className="text-[color:rgba(26,26,46,0.75)]">{feature.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default LandingFeatureCalloutsSection;
