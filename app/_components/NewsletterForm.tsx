"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/app/_lib/utils";
import { addNewsletterEntry } from "@/app/_lib/actions/newsletter.actions";
import { NewsletterFormSchema } from "@/app/_lib/schema";
import { z } from "zod";

type FormData = z.infer<typeof NewsletterFormSchema>;

const NewsletterForm = () => {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormData>({
    resolver: zodResolver(NewsletterFormSchema),
  });

  const onSubmit = async (data: FormData) => {
    clearErrors();
    const result = await addNewsletterEntry(data);

    if (result.formErrors || result.apiError) {
      setError("email", {
        type: "manual",
        message: result.message || "Something went wrong",
      });
      return;
    }

    reset();
    setTimeout(() => {
      clearErrors();
    }, 3000);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="min-w-0 flex-1 basis-36">
          <label htmlFor="newsletter-first-name" className="sr-only">
            First name (optional)
          </label>
          <Input
            {...register("firstName")}
            id="newsletter-first-name"
            placeholder="First name"
            type="text"
            autoComplete="given-name"
            disabled={isSubmitting}
            className={cn(
              "h-12 rounded-[4px] border-[#c3cbe4] bg-white text-base",
              errors.firstName && "border-destructive",
            )}
          />
        </div>
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <Input
            {...register("email")}
            id="newsletter-email"
            placeholder="you@example.com"
            type="email"
            disabled={isSubmitting}
            className={cn(
              "h-12 rounded-[4px] border-[#c3cbe4] bg-white text-base",
              errors.email && "border-destructive",
            )}
          />
        </div>
        <Button
          type="submit"
          variant="accent"
          disabled={isSubmitting}
          className="h-12 rounded-[4px] px-8 font-display text-base font-normal uppercase tracking-[0.08em]"
        >
          {isSubmitting && <Loader2 className="animate-spin" size={16} />}
          {isSubmitting ? "Signing up..." : "Sign up"}
        </Button>
      </div>
      {errors.email?.message || errors.firstName?.message ? (
        <p className="mt-3 text-sm text-destructive">
          {errors.email?.message ?? errors.firstName?.message}
        </p>
      ) : (
        <p
          className={cn(
            "mt-3 text-[13px] font-medium",
            isSubmitSuccessful ? "text-green-700" : "text-[#707687]",
          )}
        >
          {isSubmitSuccessful
            ? "You're on the list ~ thank you!"
            : "Free, monthly-ish. Unsubscribe anytime."}
        </p>
      )}
    </form>
  );
};

export default NewsletterForm;
