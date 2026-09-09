"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";
import { useWizardForm } from "@/app/(root)/private-sessions/_lib/_context/FormContext";

const CheckoutForm: React.FC = () => {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { goToNextStep } = useWizardForm();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/private-sessions/confirmation`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setErrorMessage(result.error.message || "An error occurred");
      setIsLoading(false);
    } else if (result.paymentIntent?.status === "succeeded") {
      // Payment succeeded, redirect to confirmation
      goToNextStep();
      router.push("/private-sessions/confirmation");
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">
        Payment Details
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <PaymentElement
            options={{
              layout: "tabs",
              fields: {
                billingDetails: {
                  email: "auto",
                  name: "auto",
                  address: {
                    country: "auto",
                    postalCode: "auto",
                  },
                },
              },
            }}
          />
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{errorMessage}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full font-medium rounded-lg"
          disabled={!stripe || isLoading}
        >
          {isLoading && <Loader2 className="animate-spin" size={16} />}
          {isLoading ? "Processing..." : "Complete Payment"}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          🔒 Your payment information is secure and encrypted
        </p>
      </div>
    </div>
  );
};

export default CheckoutForm;
