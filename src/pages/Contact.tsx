import { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RippleButton } from '@/components/ui/ripple-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const Contact = () => {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('contact-form', {
        body: {
          name,
          email,
          message,
        },
      });

      if (error) {
        throw error;
      }

      setIsSubmitted(true);
    } catch (error) {
      toast({
        title: 'Failed to send',
        description: error instanceof Error ? error.message : 'Unable to send your message right now.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-navy)] px-6 py-24 text-[var(--color-paper)]">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <section>
          <h1 className="mb-6 text-5xl leading-tight md:text-6xl">We are real people. Talk to us.</h1>
          <div className="space-y-6 text-[color:rgba(245,240,232,0.82)]">
            <article>
              <p className="mb-1 text-sm uppercase tracking-[0.16em] text-[var(--color-saffron)]">Email</p>
              <a href="mailto:hello@vani.ai" className="text-lg hover:underline">
                hello@vani.ai
              </a>
            </article>
            <article>
              <p className="mb-1 text-sm uppercase tracking-[0.16em] text-[var(--color-saffron)]">Discord</p>
              <a href="https://discord.gg" target="_blank" rel="noreferrer" className="text-lg hover:underline">
                Join our Discord community
              </a>
            </article>
            <article>
              <p className="mb-1 text-sm uppercase tracking-[0.16em] text-[var(--color-saffron)]">Bug Report</p>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="text-lg hover:underline">
                Report an issue on GitHub
              </a>
            </article>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:rgba(232,232,240,0.25)] bg-[color:rgba(13,17,23,0.55)] p-6 backdrop-blur-md">
          <AnimatePresence mode="wait">
            {!isSubmitted ? (
              <motion.form
                key="contact-form"
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                onSubmit={handleSubmit}
              >
                <h2 className="text-3xl">Contact form</h2>

                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="border-[color:rgba(232,232,240,0.3)] bg-[color:rgba(245,240,232,0.07)] text-[var(--color-paper)] placeholder:text-[color:rgba(245,240,232,0.54)]"
                  required
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="border-[color:rgba(232,232,240,0.3)] bg-[color:rgba(245,240,232,0.07)] text-[var(--color-paper)] placeholder:text-[color:rgba(245,240,232,0.54)]"
                  required
                />
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="How can we help?"
                  className="min-h-[180px] border-[color:rgba(232,232,240,0.3)] bg-[color:rgba(245,240,232,0.07)] text-[var(--color-paper)] placeholder:text-[color:rgba(245,240,232,0.54)]"
                  required
                />

                <RippleButton
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[var(--color-saffron)] text-white hover:bg-[color:rgba(232,137,12,0.9)]"
                >
                  {isSubmitting ? 'Sending...' : 'Send message'}
                </RippleButton>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                className="flex min-h-[320px] flex-col items-center justify-center text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                <h2 className="mb-2 text-4xl">Thank you.</h2>
                <p className="max-w-sm text-[color:rgba(245,240,232,0.82)]">
                  Your message is on its way to our inbox. We will get back to you soon.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
};

export default Contact;
