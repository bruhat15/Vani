import { motion } from "framer-motion";

const storyPanels = [
  {
    title: "Speak naturally",
    body: "Ask questions in plain language and keep your train of thought without digging through tabs.",
  },
  {
    title: "See the grounding",
    body: "Every answer maps back to the source material so trust and traceability stay visible.",
  },
  {
    title: "Build understanding",
    body: "Turn long documents into a guided learning flow that feels like a conversation.",
  },
];

const LandingStorySection = () => {
  return (
    <section className="bg-[var(--color-paper)] px-6 py-24 text-[var(--color-ink)]">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        {storyPanels.map((panel) => (
          <motion.article
            key={panel.title}
            className="rounded-3xl border border-[var(--color-mist)] bg-white/70 p-8 shadow-[0_24px_70px_rgba(26,26,46,0.08)] md:p-10"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <h2 className="mb-3 text-3xl md:text-4xl">{panel.title}</h2>
            <p className="max-w-3xl text-base text-[color:rgba(26,26,46,0.75)] md:text-lg">{panel.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default LandingStorySection;
