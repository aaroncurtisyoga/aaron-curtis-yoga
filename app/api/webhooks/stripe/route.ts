import { NextResponse } from "next/server";
import { OrderType } from "@prisma/client";
import stripe from "stripe";
import prisma from "@/app/_lib/prisma";
import { createOrder } from "@/app/_lib/actions/order.actions";

function buildOrderData(
  stripeId: string,
  amountInCents: number | null,
  metadata: stripe.Metadata | null,
  defaultType: OrderType,
) {
  return {
    buyerId: metadata?.buyerId || "",
    createdAt: new Date(),
    stripeId,
    totalAmount: amountInCents ? (amountInCents / 100).toString() : "0",
    type: (metadata?.type as OrderType) || defaultType,
    ...(metadata?.eventId && { eventId: metadata.eventId }),
  };
}

async function processOrder(order: ReturnType<typeof buildOrderData>) {
  // Idempotency: skip if this Stripe event was already processed
  const existing = await prisma.order.findUnique({
    where: { stripeId: order.stripeId },
  });
  if (existing) {
    return NextResponse.json({ message: "Order already processed" });
  }

  try {
    const newOrder = await createOrder(order);
    return NextResponse.json({ message: "OK", order: newOrder });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { message: "Error creating order" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.text();

  const sig = request.headers.get("stripe-signature") as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET!;
  let stripeEvent: stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return NextResponse.json(
      { message: "Webhook verification failed" },
      { status: 400 },
    );
  }

  const stripeEventType = stripeEvent.type;

  if (stripeEventType === "checkout.session.completed") {
    const { id, amount_total, metadata } = stripeEvent.data.object;
    return processOrder(
      buildOrderData(id, amount_total, metadata, OrderType.EVENT),
    );
  }

  if (stripeEventType === "payment_intent.succeeded") {
    const { id, amount, metadata } = stripeEvent.data.object;
    return processOrder(
      buildOrderData(id, amount, metadata, OrderType.PRIVATE_SESSION),
    );
  }

  return new Response("", { status: 200 });
}
