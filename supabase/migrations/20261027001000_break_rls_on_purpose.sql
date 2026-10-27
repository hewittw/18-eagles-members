-- FOR THE ASSIGNMENT'S FAILING TEST ONLY (reverted by the next migration): any signed-in golfer can read every card.
alter policy "Golfers read their own rounds" on public.rounds using (true);
