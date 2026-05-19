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

import React from 'react';
import { Button, Card, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const statusMap = {
  available: {
    tagType: 'success',
    label: '已开启',
    buttonText: '开始游戏',
    disabled: false,
  },
  disabled: {
    tagType: 'danger',
    label: '已关闭',
    buttonText: '已关闭',
    disabled: true,
  },
  coming_soon: {
    tagType: 'tertiary',
    label: '敬请期待',
    buttonText: '敬请期待',
    disabled: true,
  },
  maintenance: {
    tagType: 'warning',
    label: '维护中',
    buttonText: '维护中',
    disabled: true,
  },
};

const GameCard = ({ game }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const status =
    statusMap[game.enabled ? game.status : 'disabled'] || statusMap.disabled;

  return (
    <Card
      className='h-full transition-all duration-200 hover:-translate-y-1'
      shadows='hover'
      bodyStyle={{ height: '100%' }}
    >
      <div className='h-full flex flex-col'>
        <div className='flex items-start justify-between gap-3 mb-3'>
          <Title heading={5} className='!mb-0'>
            {t(game.title)}
          </Title>
          <Tag type={status.tagType}>{t(status.label)}</Tag>
        </div>

        <Paragraph className='!mb-6 flex-1 text-semi-color-text-1'>
          {t(game.description)}
        </Paragraph>

        <Button
          block
          theme='solid'
          type='primary'
          disabled={status.disabled || !game.path}
          onClick={() => {
            if (game.path) {
              navigate(game.path);
            }
          }}
        >
          {t(status.buttonText)}
        </Button>
      </div>
    </Card>
  );
};

export default GameCard;