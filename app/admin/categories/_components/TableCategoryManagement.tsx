"use client";

import { Dispatch, FC, SetStateAction, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDisclosure } from "@/app/_hooks/useDisclosure";
import { Category } from "@prisma/client";
import BasicModal from "@/app/_components/BasicModal";
import CategoryCard from "@/app/admin/categories/_components/CategoryCard";
import { deleteCategory } from "@/app/_lib/actions/category.actions";
import { Trash2 } from "lucide-react";

interface CategoryManagementTableProps {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
}

const TableCategoryManagement: FC<CategoryManagementTableProps> = ({
  categories,
  setCategories,
}) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [categoryToDelete, setCategoryToDelete] = useState<Category>();

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const result = await deleteCategory(categoryId);
      if (result.status) {
        setCategories((prev) =>
          prev.filter((category) => category.id !== categoryId),
        );
        onOpenChange();
      }
    } catch (error) {
      console.error("Failed to delete category", error);
      toast.error("Failed to delete category. Please try again.");
    }
  };

  const handleCategoryDeleteClick = (category: Category) => {
    setCategoryToDelete(category);
    onOpen();
  };

  return (
    <>
      {/* Mobile: Cards */}
      <div className="md:hidden space-y-3 mt-2">
        {categories.map((category: Category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onDeleteClick={handleCategoryDeleteClick}
          />
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block mt-2">
        <Table aria-label="Table for Managing Event Categories">
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category: Category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleCategoryDeleteClick(category)}
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <BasicModal
        onOpenChange={onOpenChange}
        isOpen={isOpen}
        header={"Delete Category"}
        primaryAction={() =>
          categoryToDelete && handleDeleteCategory(categoryToDelete.id)
        }
        primaryActionLabel={"Delete Category"}
      >
        <div>
          <p>Are you sure you want to delete this Category?</p>
          <p>{categoryToDelete?.name}</p>
        </div>
      </BasicModal>
    </>
  );
};
export default TableCategoryManagement;
