import { redirect } from "next/navigation";
import { CitySwitcher } from "@/components/CitySwitcher";
import { PageHeader } from "@/components/PageHeader";
import { SearchControls } from "@/components/search/SearchControls";
import { SearchResults } from "@/components/search/SearchResults";
import { getCities, getMyProfile } from "@/lib/auth";
import { countActiveFilters, filtersToQuery, parseFilters, parseMode } from "@/lib/filters";
import { rankedSearch, searchLobbies } from "@/lib/lobbies";

export const metadata = { title: "Поиск игр" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  const params = await searchParams;
  const parsed = parseFilters(params);
  const mode = parseMode(params);
  const cities = await getCities();
  const cityId = cities.some((c) => c.id === parsed.city) ? parsed.city! : profile.city_id;
  const filters = { ...parsed, city: cityId === profile.city_id && !parsed.city ? null : cityId };

  // Умный поиск или ключевые слова → сортировка по релевантности и «Похожие варианты»
  const ranked = Boolean(filters.ai || filters.kw.length);
  const opts = { mode, userId: profile.id };
  const { main, similar } = ranked
    ? await rankedSearch(filters, cityId, opts)
    : { main: await searchLobbies(filters, cityId, opts), similar: [] };

  const query = filtersToQuery(filters);

  return (
    <>
      <PageHeader title="Поиск игр" right={<CitySwitcher cities={cities} value={cityId} />} />
      <SearchControls key={query} filters={filters} mode={mode} cities={cities} cityId={cityId} />
      <SearchResults
        key={`${mode}${query}`}
        lobbies={main}
        similar={similar}
        ranked={ranked}
        filters={filters}
        mode={mode}
        myId={profile.id}
        listHref={`/search${filtersToQuery(filters, "list")}`}
        hasFilters={countActiveFilters(filters) > 0 || Boolean(filters.q || filters.ai)}
      />
    </>
  );
}
