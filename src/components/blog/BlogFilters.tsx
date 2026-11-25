import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { BlogPostFilters, BlogCategory } from '../../types/blog';

interface BlogFiltersComponentProps {
  filters: BlogPostFilters;
  categories: BlogCategory[];
  onFiltersChange: (filters: BlogPostFilters) => void;
  isLoading?: boolean;
}

export const BlogFilters: React.FC<BlogFiltersComponentProps> = ({
  filters,
  categories,
  onFiltersChange,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleCategoryChange = (categoryId: string) => {
    onFiltersChange({
      ...filters,
      category_id: categoryId === 'all' ? undefined : categoryId
    });
  };

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({
      ...filters,
      sort_by: sortBy as any
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setIsExpanded(false);
  };

  const hasActiveFilters = !!(
    filters.search ||
    filters.category_id ||
    (filters.sort_by && filters.sort_by !== 'newest')
  );

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700/50 p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={handleSearchChange}
            placeholder="Search articles by title or content..."
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-100 placeholder-slate-400 disabled:opacity-50 transition-all"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              isExpanded || hasActiveFilters
                ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                : 'bg-slate-800/50 text-slate-300 border border-slate-700 hover:bg-slate-700/50'
            }`}
            disabled={isLoading}
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                Active
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 rounded-lg font-medium hover:bg-red-500/30 border border-red-500/30 transition-all"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Category
            </label>
            <select
              value={filters.category_id || 'all'}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-100 disabled:opacity-50"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Sort By
            </label>
            <select
              value={filters.sort_by || 'newest'}
              onChange={(e) => handleSortChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-100 disabled:opacity-50"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="most_viewed">Most Viewed</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
