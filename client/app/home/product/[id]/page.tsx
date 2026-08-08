import { redirect } from 'next/navigation';

export default function HomeProductIdRedirect({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const query = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, val]) => {
      if (typeof val === 'string') {
        query.set(key, val);
      } else if (Array.isArray(val)) {
        val.forEach((v) => query.append(key, v));
      }
    });
  }
  const queryString = query.toString() ? `?${query.toString()}` : '';
  redirect(`/product/${params.id}${queryString}`);
}
