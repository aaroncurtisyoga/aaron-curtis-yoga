"use client";

import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/app/_lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { createCategory } from "@/app/_lib/actions/category.actions";
import { CategoryFormSchema } from "@/app/_lib/schema";
import { useRouter } from "next/navigation";
import { CheckCircle, Tag } from "lucide-react";

type Inputs = z.infer<typeof CategoryFormSchema>;

const CreateCategory: FC = () => {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Inputs>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: {
      category: "",
    },
  });

  const handleAddCategory: SubmitHandler<Inputs> = async (data) => {
    try {
      const result = await createCategory({
        categoryName: data.category.trim(),
      });
      if (result.status) {
        setShowSuccess(true);
        reset();
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      }
    } catch (e) {
      console.error("Error creating category", e);
      setError("category", {
        type: "server",
        message: "There was an issue creating the category.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="mb-2 font-display text-3xl uppercase text-foreground">
          Create Category
        </h1>
        <p className="text-muted-foreground">
          Add a new category to organize your events
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row gap-3 space-y-0 pb-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            <p className="text-lg font-semibold">New Category</p>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            onSubmit={handleSubmit(handleAddCategory)}
            className="space-y-6"
          >
            <Controller
              name={"category"}
              control={control}
              rules={{ required: true }}
              render={({ field }) => {
                return (
                  <FormField
                    label="Category Name"
                    error={errors.category?.message}
                  >
                    <Input
                      disabled={isSubmitting}
                      placeholder="Enter category name (e.g., Workshop, Social, Training)"
                      className={cn(errors.category && "border-destructive")}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </FormField>
                );
              }}
            />

            {showSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Category created successfully!
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="font-medium"
              >
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isSubmitting ? "Creating..." : "Create Category"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => router.push("/admin/categories")}
                disabled={isSubmitting}
                className="font-medium"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateCategory;
