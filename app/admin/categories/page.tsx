"use client";

import { FC, useEffect, useState, useRef } from "react";
import { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/app/_lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import {
  getAllCategories,
  createCategory,
} from "@/app/_lib/actions/category.actions";
import { CategoryFormSchema } from "@/app/_lib/schema";
import TableCategoryManagement from "@/app/admin/categories/_components/TableCategoryManagement";
import AdminPage from "@/app/admin/_components/AdminPage";
import { CheckCircle, Plus, X, Layers } from "lucide-react";

type Inputs = z.infer<typeof CategoryFormSchema>;

const AdminCategories: FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Inputs>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: {
      category: "",
    },
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const data = await getAllCategories();
      setCategories(data);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isAddingCategory && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isAddingCategory]);

  const handleAddCategory: SubmitHandler<Inputs> = async (data) => {
    try {
      const result = await createCategory({
        categoryName: data.category.trim(),
      });
      if (result.status) {
        setShowSuccess(true);
        // Refresh categories list
        const updatedCategories = await getAllCategories();
        setCategories(updatedCategories);
        reset();
        setIsAddingCategory(false);
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

  const handleCancel = () => {
    setIsAddingCategory(false);
    reset();
    clearErrors("category");
  };

  return (
    <AdminPage
      title="Categories"
      width="narrow"
      badge={
        <Badge variant="info" className="px-3 py-1 text-sm">
          {categories.length}{" "}
          {categories.length === 1 ? "Category" : "Categories"}
        </Badge>
      }
    >
      {/* Success Message */}
      {showSuccess && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 text-green-700 rounded-lg animate-in slide-in-from-top-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Category created successfully!</span>
        </div>
      )}

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col gap-3 space-y-0">
          {/* Collapsed State - Just a button */}
          {!isAddingCategory ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <p className="text-lg font-semibold">Manage Categories</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setIsAddingCategory(true)}
                className="font-medium"
              >
                <Plus className="w-4 h-4" /> Add Category
              </Button>
            </div>
          ) : (
            /* Expanded State - Show form */
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">Add New Category</p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-8 w-8 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form
                onSubmit={handleSubmit(handleAddCategory)}
                className="flex gap-2"
              >
                <Controller
                  name={"category"}
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => {
                    return (
                      <div className="flex-1 space-y-1">
                        <Input
                          ref={inputRef}
                          disabled={isSubmitting}
                          placeholder="Enter category name (e.g., Workshop, Social, Training)"
                          className={cn(
                            errors.category && "border-destructive",
                          )}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                        {errors.category?.message && (
                          <p className="text-sm text-destructive">
                            {errors.category.message}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="font-medium px-6"
                >
                  {isSubmitting && <Loader2 className="animate-spin" />}
                  {isSubmitting ? "Adding..." : "Add"}
                </Button>
              </form>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-2">
          {categories.length > 0 ? (
            <TableCategoryManagement
              categories={categories}
              setCategories={setCategories}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-3 text-muted-foreground/60" />
              <p>No categories yet. Add your first category to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
};

export default AdminCategories;
