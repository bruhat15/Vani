import { useNavigate } from "react-router-dom";
import { RippleButton } from "@/components/ui/ripple-button";

const LandingCtaSection = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-[var(--color-navy)] px-6 py-24 text-[var(--color-paper)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <h2 className="mb-4 text-4xl md:text-6xl">Bring your next notebook to life.</h2>
        <p className="mb-8 max-w-2xl text-[color:rgba(245,240,232,0.78)]">
          Start with one document and turn it into a guided conversation.
        </p>
        <RippleButton
          className="bg-[var(--color-saffron)] text-white hover:bg-[color:rgba(232,137,12,0.9)]"
          onClick={() => navigate("/auth")}
        >
          Create your first notebook
        </RippleButton>
      </div>
    </section>
  );
};

export default LandingCtaSection;
