"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useWizardForm } from "@/app/(root)/private-sessions/_lib/_context/FormContext";
import CheckoutForm from "@/app/(root)/private-sessions/checkout/_components/CheckoutForm";
import OrderSummary from "@/app/(root)/private-sessions/checkout/_components/OrderSummary";
import { StepIndicator } from "@/app/(root)/private-sessions/select-package/_components/StepIndicator";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

const CheckoutPage: React.FC = () => {
  const { formData } = useWizardForm();
  const [clientSecret, setClientSecret] = useState("");
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const createPaymentIntent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Support both new and legacy data
      const sessionPurchase = formData.sessionPurchase;
      const packageDetails = formData.packageDetails;

      let amount: number;
      let packageName: string;
      let sessionCount: number | undefined;
      let pricePerSession: number | undefined;

      if (sessionPurchase) {
        amount = sessionPurchase.totalPrice;
        packageName = `${sessionPurchase.sessionCount} ${sessionPurchase.sessionType} Sessions`;
        sessionCount = sessionPurchase.sessionCount;
        pricePerSession = sessionPurchase.pricePerSession;
      } else if (packageDetails) {
        // Legacy fallback
        amount = parseFloat(packageDetails.price);
        packageName = packageDetails.package;
      } else {
        throw new Error("No session or package data found");
      }

      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          packageName,
          sessionType: formData.sessionType,
          sessionCount,
          pricePerSession,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment intent");
      }

      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error("Error creating payment intent:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [formData]);

  // Redirect if no package or session data selected
  useEffect(() => {
    if (!formData.sessionPurchase && !formData.packageDetails) {
      router.push("/private-sessions/select-package");
      return;
    }

    createPaymentIntent();
  }, [formData, router, createPaymentIntent]);

  const appearance = {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#0842a0",
    },
  };

  const options = {
    clientSecret,
    appearance,
  };

  return (
    <div className="wrapper-width pt-6">
      {/* Step indicator */}
      <div className="text-left mb-6">
        <StepIndicator currentStep={4} totalSteps={4} />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl md:text-[32px] font-medium text-gray-900">
          Complete your payment.
        </h1>
        <p className="text-gray-700 mt-2">Secure payment powered by Stripe</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Payment form */}
        <div className="order-2 md:order-1">
          {error ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                Payment Details
              </h3>
              <div className="text-center py-12">
                <div className="text-red-600 text-lg mb-4">{error}</div>
                <Button onClick={() => createPaymentIntent()}>Try Again</Button>
              </div>
            </div>
          ) : clientSecret ? (
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm />
            </Elements>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 min-h-[502px]">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                Payment Details
              </h3>
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" />
              </div>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="order-1 md:order-2">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
