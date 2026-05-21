/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useMemo } from 'react';
import { Card, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import GameCard from '../../components/games/GameCard';
import GameRiskNotice from '../../components/games/GameRiskNotice';
import { gamesRegistry } from '../../components/games/gamesRegistry';

const { Title, Paragraph } = Typography;

const Games = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);

  const games = useMemo(
    () =>
      gamesRegistry.map((game) => ({
        ...game,
        enabled: statusState?.status?.[game.enabledField] !== false,
      })),
    [statusState?.status],
  );

  return (
    <div className='min-h-[calc(100vh-64px)] bg-semi-color-bg-0 px-4 pb-10 pt-24 md:px-8'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-8 text-center'>
          <Title heading={2} className='!mb-3'>
            {t('游戏中心')}
          </Title>
          <Paragraph className='text-semi-color-text-1'>
            {t('选择一个小游戏开始体验')}
          </Paragraph>
        </div>

        <Card className='mb-6'>
          <Paragraph className='!mb-0 text-semi-color-text-1'>
            {t(
              '游戏板块仅支持电脑端 Google Chrome 或 Microsoft Edge 浏览器访问；如果您在使用过程中遇到任何问题，请随时联系我们。',
            )}
          </Paragraph>
        </Card>

        <GameRiskNotice className='mb-6' />

        <div className='grid grid-cols-1 gap-5 md:grid-cols-3'>
          {games.map((game) => (
            <GameCard key={game.key} game={game} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Games;
